import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Globe, Menu, Mic, Paperclip, Send, Square } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { useApp } from "@/components/app/AppProvider";
import { createConversation, useInvalidate } from "@/hooks/use-data";
import { streamChat } from "@/lib/chat-client";
import { setPending, takePending } from "@/lib/pending";
import { filesToAttachments, contextFromAttachments } from "@/lib/attachments";
import { speak } from "@/lib/speech";
import { extractMemories } from "@/lib/account.functions";
import { uid, type Attachment, type ChatMessage, type Mode, type Source } from "@/lib/types";
import { cn } from "@/lib/utils";

const WORDS = ["Thinking", "Pondering", "Ruminating", "Cogitating", "Synthesizing", "Percolating", "Conjuring", "Deliberating", "Contemplating", "Simmering", "Brewing"];

function Thinking() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % WORDS.length), 2200);
    return () => clearInterval(t);
  }, []);
  return <p className="shimmer-text font-read text-lg">{WORDS[i]}…</p>;
}

export function ChatView({ conversationId, mode: initialMode, projectId }: { conversationId?: string; mode: Mode; projectId?: string | null }) {
  const { settings, setSidebarOpen } = useApp();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [atts, setAtts] = useState<Attachment[]>([]);
  const [web, setWeb] = useState(false);
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const invalidate = useInvalidate();
  const memorize = useServerFn(extractMemories);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!conversationId) return;
    let alive = true;
    supabase.from("messages").select("*").eq("conversation_id", conversationId).order("created_at").then(({ data }) => {
      if (!alive) return;
      const rows: ChatMessage[] = (data ?? []).map((m) => ({ id: m.id, role: m.role as "user" | "assistant", content: m.content, meta: m.sources as ChatMessage["meta"] }));
      setMessages(rows);
      const p = takePending(conversationId);
      if (p) void run(rows, p.text, p.attachments, p.webSearch, p.speak);
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  async function run(history: ChatMessage[], text: string, attachments: Attachment[], webSearch: boolean, forceSpeak?: boolean) {
    const ctx = contextFromAttachments(attachments);
    const images = attachments.filter((a) => a.kind === "image").map((a) => a.dataUrl!);
    const user: ChatMessage = { id: uid(), role: "user", content: text, images, meta: { files: attachments.map((a) => a.name), context: ctx } };
    const next = [...history, user];
    setMessages(next);
    setBusy(true);
    await supabase.from("messages").insert({ conversation_id: conversationId!, role: "user", content: text, sources: (user.meta ?? {}) as unknown as Json });
    const wire = next.map((m) => ({ role: m.role, content: m.meta?.context ? `${m.content}\n\n${m.meta.context}` : m.content, images: m.images }));
    let reply = "";
    let sources: Source[] | undefined;
    const aid = uid();
    abort.current = new AbortController();
    try {
      await streamChat({ messages: wire, mode, webSearch, projectId }, {
        onText: (t) => { reply += t; setMessages([...next, { id: aid, role: "assistant", content: reply }]); },
        onSources: (s) => { sources = s; },
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
      const id = await createConversation({ mode, projectId, title: text || a[0]?.name || "New chat" });
      setPending(id, { text, attachments: a, webSearch: web });
      invalidate("conversations");
      navigate({ to: "/c/$id", params: { id } });
      return;
    }
    void run(messages, text, a, web);
  }

  async function switchMode(m: Mode) {
    setMode(m);
    if (conversationId) { await supabase.from("conversations").update({ mode: m }).eq("id", conversationId); invalidate("conversations"); }
  }

  const dictate = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const C = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!C) return;
    const r = new C();
    r.onresult = (e: { results: { 0: { transcript: string } }[] }) => setInput((v) => `${v} ${e.results[0][0].transcript}`.trim());
    r.start();
  };

  const last = messages[messages.length - 1];
  return (
    <div className={cn("flex h-full flex-col", mode === "code" && "mode-code")}>
      <header className="flex items-center gap-2 border-b border-border px-4 py-2">
        <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setSidebarOpen(true)} aria-label="Open sidebar"><Menu className="size-4" /></Button>
        <div className="mx-auto flex rounded-full border border-border p-0.5 text-sm">
          {(["chat", "code"] as const).map((m) => (
            <button key={m} onClick={() => switchMode(m)} className={cn("rounded-full px-4 py-1 transition-colors", mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground", m === "code" && "font-mono")}>
              {m === "chat" ? "Chat" : "C0DE"}
            </button>
          ))}
        </div>
      </header>
      <div className="flex-1 overflow-y-auto">
        {!messages.length ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 animate-fade-up">
            <Logo className="size-20" />
            <p className={cn("text-2xl", mode === "code" ? "font-mono" : "font-read")}>Hello how may I help ?</p>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
            {messages.map((m) => m.role === "user" ? (
              <div key={m.id} className="ml-auto w-fit max-w-[85%] rounded-2xl bg-bubble px-4 py-2.5 text-bubble-foreground">
                {m.images?.map((src, i) => <img key={i} src={src} alt="attachment" className="mb-2 max-h-48 rounded-lg" />)}
                <p className="whitespace-pre-wrap">{m.content}</p>
                {!!m.meta?.files?.length && <p className="mt-1 text-xs text-muted-foreground">📎 {m.meta.files.join(", ")}</p>}
              </div>
            ) : (
              <div key={m.id} className="prose-millie animate-fade-up">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                {!!m.meta?.sources?.length && (
                  <div className="mt-3 border-t border-border pt-2 text-sm font-sans">
                    <p className="text-xs text-muted-foreground">Sources</p>
                    {m.meta.sources.map((s) => <a key={s.uri} href={s.uri} target="_blank" rel="noreferrer" className="block truncate">{s.title}</a>)}
                  </div>
                )}
              </div>
            ))}
            {busy && last?.role === "user" && <Thinking />}
            <div ref={endRef} />
          </div>
        )}
      </div>
      <div className="mx-auto w-full max-w-3xl px-4 pb-4">
        {!!atts.length && (
          <div className="mb-2 flex flex-wrap gap-2">
            {atts.map((a) => (
              <button key={a.id} onClick={() => setAtts((x) => x.filter((y) => y.id !== a.id))} className="rounded-full border border-border px-3 py-1 text-xs">{a.name} ×</button>
            ))}
          </div>
        )}
        <div className="glow flex items-end gap-1 rounded-2xl border border-border bg-card p-2">
          <input ref={fileRef} type="file" multiple hidden onChange={async (e) => { if (e.target.files) setAtts([...atts, ...(await filesToAttachments(e.target.files))]); e.target.value = ""; }} />
          <Button variant="ghost" size="icon" onClick={() => fileRef.current?.click()} aria-label="Attach"><Paperclip className="size-4" /></Button>
          <Button variant="ghost" size="icon" onClick={() => setWeb(!web)} aria-label="Search the web" className={cn(web && "text-primary")}><Globe className="size-4" /></Button>
          <textarea
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
            onPaste={async (e) => { const f = [...e.clipboardData.files]; if (f.length) setAtts([...atts, ...(await filesToAttachments(f))]); }}
            rows={1}
            placeholder={mode === "code" ? "Ask C0DE to build something…" : "Message Millie…"}
            className="max-h-48 flex-1 resize-none bg-transparent px-2 py-2 outline-none"
          />
          <Button variant="ghost" size="icon" onClick={dictate} aria-label="Dictate"><Mic className="size-4" /></Button>
          {busy ? (
            <Button size="icon" onClick={() => abort.current?.abort()} aria-label="Stop"><Square className="size-4" /></Button>
          ) : (
            <Button size="icon" onClick={send} aria-label="Send"><Send className="size-4" /></Button>
          )}
        </div>
      </div>
    </div>
  );
}
