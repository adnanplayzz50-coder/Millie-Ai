import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Camera, Download, Monitor, Send, Settings, X } from "lucide-react";
import { cachedSettings, isDark } from "@/lib/theme";

export const Route = createFileRoute("/localmillie")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Millie AI (Local)" },
      { name: "description", content: "Millie AI running on a model on your own computer." },
      { property: "og:title", content: "Millie AI (Local)" },
      { property: "og:description", content: "Millie AI running on a model on your own computer." },
    ],
  }),
  component: MillieLocal,
});

type Mode = "local" | "online";

type Cfg = {
  mode: Mode;
  localModel: string;
  localVisionModel: string;
  onlineUrl: string;
  onlineModel: string;
  onlineKey: string;
};

type Msg = {
  role: "user" | "assistant" | "system";
  content: string;
  image?: string; // data URL (JPEG) from screen or camera capture
};

const DEFAULTS: Cfg = {
  mode: "local",
  localModel: "qwen3:1.7b",
  localVisionModel: "gemma3:4b",
  onlineUrl: "https://api.groq.com/openai/v1",
  onlineModel: "llama-3.1-8b-instant",
  onlineKey: "",
};

const STORAGE_KEY = "millieLocalCfg";
// Same key the main app's Customize panel saves to, so this page follows it.
const LOOK_KEY = "millie-settings";

const SYSTEM: Msg = {
  role: "system",
  content: "You are Millie, a calm, capable assistant. Answer clearly and briefly.",
};

// Applies the saved Customize choices (theme, palette, font, custom color) to this page.
// It only reads them. Changing them happens in Millie chat, under Settings, then Customize.
function syncLook() {
  const s = cachedSettings();
  const root = document.documentElement;
  root.dataset.font = s.font;
  root.dataset.palette = s.palette;
  root.classList.toggle("dark", isDark(s.theme));
  if (s.custom_color) root.style.setProperty("--primary", s.custom_color);
  else root.style.removeProperty("--primary");
}

const screenShareSupported = () =>
  typeof navigator !== "undefined" &&
  !!navigator.mediaDevices &&
  typeof navigator.mediaDevices.getDisplayMedia === "function";

// Grabs one frame from the screen (desktop, Android Chrome where supported) or the
// camera (works on iPhone and Android, so it is the fallback when screen share is missing).
async function captureFrame(kind: "screen" | "camera"): Promise<string> {
  const stream =
    kind === "screen"
      ? await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
      : await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });

  try {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    await video.play();
    // Give the first frame time to arrive before drawing it.
    await new Promise((r) => setTimeout(r, 500));

    const scale = Math.min(1, 1024 / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not draw the captured frame.");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.8);
  } finally {
    stream.getTracks().forEach((t) => t.stop());
  }
}

const stripDataUrl = (u: string) => u.split(",")[1] ?? u;

function MillieLocal() {
  const [cfg, setCfg] = useState<Cfg>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const [online, setOnline] = useState(true);

  // Track the internet connection. With no internet, Millie always runs locally.
  useEffect(() => {
    setOnline(navigator.onLine);
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);
  const mode: Mode = online ? cfg.mode : "local";

  // Is this page saved on the device and is the service worker running? Both are needed
  // for the page to open with no internet.
  const [offlineReady, setOfflineReady] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    const check = async () => {
      try {
        const saved = !!(await caches.match("/localmillie"));
        const active = !!navigator.serviceWorker?.controller;
        if (alive) setOfflineReady(saved && active);
      } catch {
        if (alive) setOfflineReady(false);
      }
    };
    check();
    const timer = setInterval(check, 3000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  // Load this page's own settings (mode, models, key).
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setCfg({ ...DEFAULTS, ...JSON.parse(saved) });
    } catch {
      // ignore a corrupted settings value and keep the defaults
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  }, [cfg, loaded]);

  // Follow the main app's Customize choices, including changes made in another tab.
  useEffect(() => {
    syncLook();
    const onStorage = (e: StorageEvent) => {
      if (e.key === LOOK_KEY || e.key === null) syncLook();
    };
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    window.addEventListener("storage", onStorage);
    mq.addEventListener("change", syncLook);
    return () => {
      window.removeEventListener("storage", onStorage);
      mq.removeEventListener("change", syncLook);
    };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  async function askLocal(all: Msg[]): Promise<string> {
    const recent = [SYSTEM, ...all.slice(-10)];
    const hasImage = recent.some((m) => m.image);
    const model = hasImage ? cfg.localVisionModel : cfg.localModel;

    let r: Response;
    try {
      r = await fetch("http://localhost:11434/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: recent.map((m) =>
            m.image
              ? { role: m.role, content: m.content, images: [stripDataUrl(m.image)] }
              : { role: m.role, content: m.content },
          ),
          stream: false,
          think: false,
          options: { num_ctx: 2048 },
        }),
      });
    } catch {
      throw new Error(
        "Can't reach Ollama on this device. Local mode only works in a browser on the computer running Ollama, with OLLAMA_ORIGINS allowing this site.",
      );
    }
    if (!r.ok) throw new Error(`Ollama returned ${r.status}. Check the model name and OLLAMA_ORIGINS.`);
    const j = await r.json();
    return j.message.content as string;
  }

  async function askOnline(all: Msg[]): Promise<string> {
    if (!cfg.onlineKey) throw new Error("Add your API key in Settings first.");
    const recent = [SYSTEM, ...all.slice(-10)];

    const r = await fetch(cfg.onlineUrl.replace(/\/$/, "") + "/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + cfg.onlineKey,
      },
      body: JSON.stringify({
        model: cfg.onlineModel,
        messages: recent.map((m) =>
          m.image
            ? {
                role: m.role,
                content: [
                  { type: "text", text: m.content },
                  { type: "image_url", image_url: { url: m.image } },
                ],
              }
            : { role: m.role, content: m.content },
        ),
      }),
    });
    if (!r.ok) throw new Error(`API returned ${r.status}. Check the key, URL, and model name.`);
    const j = await r.json();
    return j.choices[0].message.content as string;
  }

  async function send() {
    const text = input.trim();
    if ((!text && !pendingImage) || busy) return;

    const userMsg: Msg = {
      role: "user",
      content: text || "What do you see in this image?",
      image: pendingImage ?? undefined,
    };
    const previous = messages;
    const next = [...messages, userMsg];

    setMessages(next);
    setInput("");
    setPendingImage(null);
    setNotice(null);
    setBusy(true);

    try {
      const reply = mode === "local" ? await askLocal(next) : await askOnline(next);
      setMessages([...next, { role: "assistant", content: reply }]);
    } catch (e) {
      // Put the message back so nothing is lost.
      setMessages(previous);
      setInput(text);
      setPendingImage(userMsg.image ?? null);
      setNotice(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function grab(kind: "screen" | "camera") {
    setNotice(null);
    try {
      setPendingImage(await captureFrame(kind));
    } catch {
      setNotice(
        kind === "screen"
          ? screenShareSupported()
            ? "Screen share was cancelled or blocked."
            : "Screen sharing isn't supported in this browser (iPhone Safari doesn't allow it). Use Camera to point at your screen."
          : "Camera access was blocked or isn't available.",
      );
    }
  }

  function downloadChat() {
    const blob = new Blob([JSON.stringify({ mode, messages }, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `millie-chat-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const screenOk = loaded && screenShareSupported();
  const modelLabel = mode === "local" ? cfg.localModel : cfg.onlineModel;

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <strong className="text-base">Millie AI</strong>
          <span className="text-xs text-muted-foreground">
            {mode === "local" ? "Local" : "Online"}: {modelLabel}
            {!online && " (offline)"}
          </span>
          {online && offlineReady !== null && (
            <span className="text-xs text-muted-foreground">
              {offlineReady ? "Offline ready" : "Not saved for offline yet. Refresh once."}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {online && (
            <Link to="/chat" className="text-sm text-muted-foreground hover:text-foreground">
              Back to Millie chat
            </Link>
          )}
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent"
          >
            <Settings className="h-4 w-4" /> Settings
          </button>
        </div>
      </header>

      <main className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="mt-10 text-center text-sm text-muted-foreground">
            Ask Millie something, or share your screen or camera so she can look at it.
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[85%] whitespace-pre-wrap rounded-xl px-3 py-2 text-sm leading-relaxed ${
              m.role === "user"
                ? "ml-auto bg-primary text-primary-foreground"
                : "mr-auto border border-border bg-card text-card-foreground"
            }`}
          >
            {m.image && (
              <img src={m.image} alt="Shared capture" className="mb-2 max-h-56 rounded-md" />
            )}
            {m.content}
          </div>
        ))}
        {busy && <div className="mr-auto text-sm text-muted-foreground">Millie is thinking...</div>}
        <div ref={endRef} />
      </main>

      {notice && (
        <div className="mx-4 mb-2 flex items-start justify-between gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {pendingImage && (
        <div className="mx-4 mb-2 flex items-center gap-2">
          <img src={pendingImage} alt="Pending capture" className="h-14 rounded-md border border-border" />
          <span className="text-xs text-muted-foreground">Capture ready. Add a question and send.</span>
          <button type="button" onClick={() => setPendingImage(null)} aria-label="Remove capture">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <form
        className="flex items-center gap-2 border-t border-border p-3"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <button
          type="button"
          onClick={() => grab("screen")}
          disabled={!screenOk || busy}
          title={screenOk ? "Share screen" : "Screen sharing isn't supported in this browser"}
          className="rounded-md border border-border p-2 hover:bg-accent disabled:opacity-40"
          aria-label="Share screen"
        >
          <Monitor className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => grab("camera")}
          disabled={busy}
          title="Use camera"
          className="rounded-md border border-border p-2 hover:bg-accent disabled:opacity-40"
          aria-label="Use camera"
        >
          <Camera className="h-5 w-5" />
        </button>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Message Millie..."
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
          autoComplete="off"
        />
        <button
          type="submit"
          disabled={busy || (!input.trim() && !pendingImage)}
          className="rounded-md bg-primary p-2 text-primary-foreground disabled:opacity-40"
          aria-label="Send"
        >
          <Send className="h-5 w-5" />
        </button>
      </form>

      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="flex max-h-full w-full max-w-md flex-col gap-3 overflow-y-auto rounded-xl border border-border bg-card p-5 text-card-foreground">
            <div className="flex items-center justify-between">
              <strong>Settings</strong>
              <button type="button" onClick={() => setSettingsOpen(false)} aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="rounded-md border border-border p-3 text-xs text-muted-foreground">
              Theme, colors and font follow your Customize choices in Millie chat.{" "}
              {online ? (
                <>
                  <Link to="/chat" className="underline">
                    Open Millie chat
                  </Link>{" "}
                  and go to Settings, then Customize to change them.
                </>
              ) : (
                "Reconnect to the internet to change them."
              )}
            </div>

            <label className="text-xs text-muted-foreground">Mode</label>
            <div className="flex overflow-hidden rounded-md border border-border">
              {(["local", "online"] as Mode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setCfg({ ...cfg, mode: m })}
                  disabled={!online && m === "online"}
                  className={`flex-1 py-2 text-sm disabled:opacity-40 ${
                    mode === m ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                  }`}
                >
                  {m === "local" ? "Local (Ollama)" : "Online (API)"}
                </button>
              ))}
            </div>

            <label className="text-xs text-muted-foreground">Local model (Ollama)</label>
            <input
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={cfg.localModel}
              onChange={(e) => setCfg({ ...cfg, localModel: e.target.value })}
            />

            <label className="text-xs text-muted-foreground">Local vision model (used when a capture is attached)</label>
            <input
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={cfg.localVisionModel}
              onChange={(e) => setCfg({ ...cfg, localVisionModel: e.target.value })}
            />

            <label className="text-xs text-muted-foreground">Online API base URL</label>
            <input
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={cfg.onlineUrl}
              onChange={(e) => setCfg({ ...cfg, onlineUrl: e.target.value })}
            />

            <label className="text-xs text-muted-foreground">Online model name</label>
            <input
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={cfg.onlineModel}
              onChange={(e) => setCfg({ ...cfg, onlineModel: e.target.value })}
            />

            <label className="text-xs text-muted-foreground">API key (saved only in this browser)</label>
            <input
              type="password"
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={cfg.onlineKey}
              onChange={(e) => setCfg({ ...cfg, onlineKey: e.target.value })}
              placeholder="paste your key"
            />

            <p className="text-xs text-muted-foreground">
              Local mode only works in a browser on the computer running Ollama. For images in Online mode, use a
              vision-capable model name.
            </p>

            <div className="mt-1 flex justify-between gap-2">
              <button
                type="button"
                onClick={downloadChat}
                className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent"
              >
                <Download className="h-4 w-4" /> Download chat
              </button>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
