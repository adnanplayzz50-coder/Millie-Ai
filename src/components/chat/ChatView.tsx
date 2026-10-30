import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Markdown } from "./Markdown";
import { ProjectCard } from "./ProjectCard";
import { FileCard } from "./FileCard";
import { FILE_HINT, isFileRequest } from "@/lib/file-gen";
import { parseReply } from "@/lib/project-parser";
import { FileText, Globe, Image as ImageIcon, Menu, Mic, Monitor, Plus, Send, Square, Video } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useApp } from "@/components/app/AppProvider";
import { createConversation, useInvalidate } from "@/hooks/use-data";
import { streamChat } from "@/lib/chat-client";
import { setPending, takePending } from "@/lib/pending";
import { filesToAttachments, contextFromAttachments } from "@/lib/attachments";
import { captureScreen } from "@/lib/capture";
import { speak } from "@/lib/speech";
import { extractMemories } from "@/lib/account.functions";
import { uid, type Attachment, type ChatMessage, type Mode, type Source } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ImageRegionModal } from "./ImageRegionModal";
import { VideoCall, type CallPayload } from "./VideoCall";

const WORDS = ["Thinking", "Pondering", "Ruminating", "Cogitating", "Synthesizing", "Percolating", "Conjuring", "Deliberating", "Contemplating", "Simmering", "Brewing"];

function Thinking() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % WORDS.length), 2200);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="flex items-center gap-2">
      <span className="inline-flex size-3.5 animate-pulse rounded-full border-2 border-primary" />
      <p className="shimmer-text font-read text-lg">{WORDS[i]}…</p>
    </div>
  );
}

const GREETINGS = [
  "Hello how may I help ?",
  "What's on your mind?",
  "Ready when you are.",
  "What shall we explore today?",
  "How can I help today?",
  "What would you like to work on?",
  "Ask me anything.",
  "What are we building today?",
  "Need a hand with something?",
  "What's the plan for today?",
  "Where should we start?",
  "What can I do for you?",
  "Got a question? I'm listening.",
  "What's on the agenda?",
  "Let's get something done.",
  "What do you want to figure out?",
  "Tell me what you need.",
  "What's next?",
  "Ready to help. What's up?",
  "Curious about something?",
  "What shall I help you with?",
  "What's the idea?",
  "Let's think it through together.",
  "What are you working on?",
  "How can I make your day easier?",
];

function randomGreeting() {
  return GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
}

export function ChatView({ conversationId, mode: initialMode, projectId }: { conversationId?: string; mode: Mode; projectId?: string | null }) {
  const { settings, setSidebarOpen } = useApp();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [atts, setAtts] = useState<Attachment[]>([]);
  const [web, setWeb] = useState(false);
  const [busy, setBusy] = useState(false);
  const [greeting] = useState(randomGreeting);
  const [callOpen, setCallOpen] = useState(false);
  const [regionId, setRegionId] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const invalidate = useInvalidate();
  const memorize = useServerFn(extractMemories);
  const endRef = useRef<HTMLDivElement>(null);
  const [justDone, setJustDone] = useState(false);
  const wasBusy = useRef(false);

  useEffect(() => {
    if (busy) {
      wasBusy.current = true;
      setJustDone(false);
    } else if (wasBusy.current) {
      wasBusy.current = false;
      setJustDone(true);
    }
  }, [busy]);

  // Keep the completed icon visible for five full seconds.
  useEffect(() => {
    if (!justDone) return;
    const t = window.setTimeout(() => setJustDone(false), 5000);
    return () => window.clearTimeout(t);
  }, [justDone]);

  // Idle uses the standard favicon; thinking and completion use transparent SVG icons.
  useEffect(() => {
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }

    if (busy) {
      link.href = "/favicon-thinking.svg?v=4";
    } else if (justDone) {
      link.href = "/favicon-filled.png?v=4";
    } else {
      link.href = "/favicon-hollow.png?v=4";
    }
  }, [busy, justDone]);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Ctrl+Shift+S takes a screenshot while the tab is focused.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void screenshot();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    if (!conversationId) return;
    let alive = true;
    supabase.from("messages").select("*").eq("conversation_id", conversationId).order("created_at").then(({ data }) => {
      if (!alive) return;
      const rows: ChatMessage[] = (data ?? []).map((m) => ({ id: m.id, role: m.role as "user" | "assistant", content: m.content, meta: m.sources as ChatMessage["meta"] }));
      setMessages(rows);
      const p = takePending(conversationId);
      if (p) void run(rows, p.text, p.attachments, p.webSearch, p.speak, p.hint);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  async function run(history: ChatMessage[], text: string, attachments: Attachment[], webSearch: boolean, forceSpeak?: boolean, hint?: string) {
    const ctx = contextFromAttachments(attachments);
    const images = attachments.filter((a) => a.kind === "image").map((a) => a.dataUrl!);
    const user: ChatMessage = { id: uid(), role: "user", content: text, images, meta: { files: attachments.map((a) => a.name), context: ctx } };
    const next = [...history, user];
    setMessages(next);
    setBusy(true);
    await supabase.from("messages").insert({ conversation_id: conversationId!, role: "user", content: text, sources: (user.meta ?? {}) as unknown as Json });
    if (!hint && isFileRequest(text)) hint = FILE_HINT;
    const wire = next.map((m, i) => ({
      role: m.role,
      content: (m.meta?.context ? `${m.content}\n\n${m.meta.context}` : m.content) + (hint && i === next.length - 1 ? `\n\n${hint}` : ""),
      images: m.images,
    }));
    let reply = "";
    let sources: Source[] | undefined;
    const aid = uid();
    abort.current = new AbortController();
    try {
      await streamChat({ messages: wire, mode, webSearch, projectId }, {
        onText: (t) => {
          reply += t;
          setMessages([...next, { id: aid, role: "assistant", content: reply }]);
        },
        onSources: (s) => {
          sources = s;
        },
      }, abort.current.signal);
    } catch (e) {
      if ((e as Error).name !== "AbortError") reply = reply || `⚠️ ${(e as Error).message}`;
    }
    setMessages([...next, { id: aid, role: "assistant", content: reply, meta: { sources } }]);
    setBusy(false);
    if (reply) {
      await supabase.from("messages").insert({ conversation_id: conversationId!, role: "assistant", content: reply, sources: { sources: sources ?? [] } as unknown as Json });
      await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId!);
      invalidate("conversations");
      if (settings.read_aloud || forceSpeak) speak(reply);
      memorize({ data: { transcript: next.slice(-6).map((m) => `${m.role}: ${m.content}`).join("\n") + `\nassistant: ${reply}` } }).catch(() => {});
    }
  }

  async function send() {
    const text = input.trim();
    if ((!text && !atts.length) || busy) return;
    setInput("");
    const a = atts;
    setAtts([]);
    if (!conversationId) {
      try {
        const id = await createConversation({ mode, projectId, title: text || a[0]?.name || "New chat" });
        setPending(id, { text, attachments: a, webSearch: web });
        invalidate("conversations");
        navigate({ to: "/c/$id", params: { id } });
      } catch (e) {
        setInput(text);
        setAtts(a);
        setMessages((prev) => [...prev, { id: uid(), role: "assistant", content: `⚠️ Could not start a chat: ${(e as Error).message}. Check your Supabase connection and database permissions.` }]);
      }
      return;
    }
    void run(messages, text, a, web).catch((e) => {
      setBusy(false);
      setMessages((prev) => [...prev, { id: uid(), role: "assistant", content: `⚠️ Millie couldn't send that message: ${(e as Error).message}` }]);
    });
  }

  async function sendFromCall({ text, images, hint }: CallPayload) {
    const callAtts: Attachment[] = images.map((dataUrl, i) => ({ id: uid(), kind: "image", name: `frame-${i + 1}.png`, dataUrl }));
    if (!conversationId) {
      const id = await createConversation({ mode, projectId, title: text.slice(0, 60) || "Video call" });
      setPending(id, { text, attachments: callAtts, webSearch: false, hint });
      invalidate("conversations");
      navigate({ to: "/c/$id", params: { id } });
      return;
    }
    void run(messages, text, callAtts, false, false, hint);
  }

  async function screenshot() {
    try {
      const dataUrl = await captureScreen();
      if (dataUrl) setAtts((x) => [...x, { id: uid(), kind: "image", name: "screenshot.png", dataUrl }]);
    } catch {
      // The user cancelled the screen picker, or the browser doesn't support it.
    }
  }

  async function switchMode(m: Mode) {
    setMode(m);
    if (conversationId) {
      await supabase.from("conversations").update({ mode: m }).eq("id", conversationId);
      invalidate("conversations");
    }
  }

  const dictate = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const C = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!C) return;
    const r = new C();
    r.onresult = (e: { results: { 0: { transcript: string } }[] }) => setInput((v) => `${v} ${e.results[0][0].transcript}`.trim());
    r.start();
  };

  const regionAtt = atts.find((a) => a.id === regionId);
  const last = messages[messages.length - 1];

  return (
    <div className={cn("flex h-full flex-col", mode === "code" && "mode-code")}>
      <header className="relative flex items-center gap-2 border-b border-border px-4 py-2">
        <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setSidebarOpen(true)} aria-label="Open sidebar">
          <Menu className="size-4" />
        </Button>
        <div className="mx-auto flex rounded-full border border-border p-0.5 text-sm">
          {(["chat", "code"] as const).map((m) => (
            <button
              key={m}
              onClick={() => switchMode(m)}
              className={cn("rounded-full px-4 py-1 transition-colors", mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground", m === "code" && "font-mono")}
            >
              {m === "chat" ? "Chat" : "C0DE"}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        {!messages.length ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 animate-fade-up">
            <Logo className="size-36" />
            <p className={cn("text-2xl", mode === "code" ? "font-mono" : "font-read")}>{greeting}</p>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
            {messages.map((m, idx) =>
              m.role === "user" ? (
                <div key={m.id} className="ml-auto w-fit max-w-[85%] rounded-2xl bg-bubble px-4 py-2.5 text-bubble-foreground">
                  {m.images?.map((src, i) => (
                    <img key={i} src={src} alt="attachment" className="mb-2 max-h-48 rounded-lg" />
                  ))}
                  <p className="whitespace-pre-wrap">{m.content}</p>
                  {!!m.meta?.files?.length && <p className="mt-1 text-xs text-muted-foreground">📎 {m.meta.files.join(", ")}</p>}
                </div>
              ) : (
                <div key={m.id} className="prose-millie animate-fade-up">
                  {(() => {
                    const r = parseReply(m.content);
                    const prev = messages[idx - 1];
                    const wantsFile = !r.project && prev?.role === "user" && isFileRequest(prev.content) && !(busy && idx === messages.length - 1) && m.content.length > 40;
                    return (
                      <>
                        {r.before && <Markdown>{r.before}</Markdown>}
                        {r.project && <ProjectCard project={r.project} />}
                        {r.after && <Markdown>{r.after}</Markdown>}
                        {wantsFile && <FileCard content={m.content} />}
                      </>
                    );
                  })()}
                  {!!m.meta?.sources?.length && (
                    <div className="mt-3 border-t border-border pt-2 font-sans text-sm">
                      <p className="text-xs text-muted-foreground">Sources</p>
                      {m.meta.sources.map((s) => (
                        <a key={s.uri} href={s.uri} target="_blank" rel="noreferrer" className="block truncate">
                          {s.title}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ),
            )}
            {busy && last?.role === "user" && <Thinking />}
            <div ref={endRef} />
          </div>
        )}
      </div>

      <div className="mx-auto w-full max-w-3xl px-4 pb-4">
        {!!atts.length && (
          <div className="mb-2 flex flex-wrap gap-2">
            {atts.map((a) => (
              <span key={a.id} className="inline-flex items-center gap-0.5 rounded-full border border-border text-xs">
                {a.kind === "image" && a.dataUrl ? (
                  <button onClick={() => setRegionId(a.id)} title="Click to select part of this image" className="flex items-center gap-1.5 rounded-full px-2 py-1 hover:bg-muted">
                    <img src={a.dataUrl} alt="" className="size-5 rounded object-cover" />
                    {a.name}
                  </button>
                ) : (
                  <span className="px-2 py-1">{a.name}</span>
                )}
                <button onClick={() => setAtts((x) => x.filter((y) => y.id !== a.id))} aria-label={`Remove ${a.name}`} className="rounded-full px-1.5 py-1 hover:bg-muted">
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="glow flex items-end gap-1 rounded-2xl border border-border bg-card p-2">
          <input
            ref={fileRef}
            type="file"
            multiple
            hidden
            onChange={async (e) => {
              if (e.target.files) setAtts([...atts, ...(await filesToAttachments(e.target.files))]);
              e.target.value = "";
            }}
          />
          <input
            ref={imageRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={async (e) => {
              if (e.target.files) setAtts([...atts, ...(await filesToAttachments(e.target.files))]);
              e.target.value = "";
            }}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0 rounded-full" aria-label="Open attachments and tools" title="Add files, images, or tools">
                <Plus className="size-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" sideOffset={12} className="w-72 rounded-xl border-border/80 bg-popover/95 p-2 shadow-xl backdrop-blur-xl">
              <DropdownMenuLabel className="px-3 pb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Add to your message</DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => fileRef.current?.click()} className="gap-3 rounded-lg px-3 py-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sky-500/15 text-sky-400"><FileText className="size-5" /></span>
                <span className="flex min-w-0 flex-col gap-0.5"><span>Files</span><span className="text-xs font-normal text-muted-foreground">Attach documents and other files</span></span>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => imageRef.current?.click()} className="gap-3 rounded-lg px-3 py-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-400/15 text-amber-300"><ImageIcon className="size-5" /></span>
                <span className="flex min-w-0 flex-col gap-0.5"><span>Image</span><span className="text-xs font-normal text-muted-foreground">Add an image for Millie to analyze</span></span>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => { void screenshot(); }} className="gap-3 rounded-lg px-3 py-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300"><Monitor className="size-5" /></span>
                <span className="flex min-w-0 flex-col gap-0.5"><span>Take a screenshot</span><span className="text-xs font-normal text-muted-foreground">Capture your screen for Millie</span></span>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setCallOpen(true)} className="gap-3 rounded-lg px-3 py-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-rose-500/15 text-rose-300"><Video className="size-5" /></span>
                <span className="flex min-w-0 flex-col gap-0.5"><span>Video call with Millie</span><span className="text-xs font-normal text-muted-foreground">Talk face-to-face with Millie</span></span>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setWeb((v) => !v)} className="gap-3 rounded-lg px-3 py-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sky-500/15 text-sky-400"><Globe className="size-5" /></span>
                <span className="flex min-w-0 flex-col gap-0.5"><span>{web ? "Turn off web search" : "Turn on web search"}</span><span className="text-xs font-normal text-muted-foreground">Search the web with Google{web ? " · On" : ""}</span></span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setWeb((v) => !v)}
            aria-label="Search the web with Google"
            title={web ? "Google web search is on" : "Search the web with Google"}
            className={cn("shrink-0", web && "text-primary")}
          >
            <Globe className="size-4" />
          </Button>

          <textarea
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            onPaste={async (e) => {
              const f = [...e.clipboardData.files];
              if (f.length) setAtts([...atts, ...(await filesToAttachments(f))]);
            }}
            onInput={(e) => {
              const el = e.currentTarget;
              const max = Math.round(window.innerHeight * 0.6);
              el.style.height = "auto";
              el.style.height = Math.min(el.scrollHeight, max) + "px";
              el.style.overflowY = el.scrollHeight > max ? "auto" : "hidden";
            }}
            rows={1}
            placeholder={mode === "code" ? "Ask C0DE to build something…" : "Message Millie…"}
            className="flex-1 resize-none overflow-hidden bg-transparent px-2 py-2 leading-6 outline-none"
          />
          <Button variant="ghost" size="icon" onClick={dictate} aria-label="Dictate">
            <Mic className="size-4" />
          </Button>
          {busy ? (
            <Button size="icon" onClick={() => abort.current?.abort()} aria-label="Stop">
              <Square className="size-4" />
            </Button>
          ) : (
            <Button size="icon" onClick={send} aria-label="Send">
              <Send className="size-4" />
            </Button>
          )}
        </div>
      </div>

      {regionAtt?.dataUrl && (
        <ImageRegionModal
          src={regionAtt.dataUrl}
          onClose={() => setRegionId(null)}
          onUse={(dataUrl) => {
            setAtts((x) => x.map((a) => (a.id === regionId ? { ...a, dataUrl } : a)));
            setRegionId(null);
          }}
        />
      )}

      <VideoCall
        open={callOpen}
        onClose={() => setCallOpen(false)}
        messages={messages}
        busy={busy}
        onSend={(p) => void sendFromCall(p)}
      />
    </div>
  );
}
