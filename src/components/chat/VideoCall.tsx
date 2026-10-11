import { useEffect, useRef, useState } from "react";
import { Markdown } from "./Markdown";
import { Camera, Mic, MicOff, Monitor, PenLine, PhoneOff, Send, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { captureFrom, markedFrame, type Pt } from "@/lib/capture";
import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface CallPayload {
  text: string;
  images: string[];
  hint: string;
}

const CALL_HINT =
  "(Context: this is a live video call. The attached image is what the user is sharing right now. Answer based on what you can see in it.)";
const PEN_HINT =
  "(Context: the user marked part of the shared view with a pen. Image 1 is the full frame with their marking drawn in fuchsia. Image 2, if present, is a close-up of the marked area. Answer about exactly the marked thing.)";

type Source = "screen" | "camera";

export function VideoCall({
  open,
  onClose,
  messages,
  busy,
  onSend,
}: {
  open: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  busy: boolean;
  onSend: (p: CallPayload) => void;
}) {
  const [source, setSource] = useState<Source | null>(null);
  const [text, setText] = useState("");
  const [pen, setPen] = useState(false);
  const [frozen, setFrozen] = useState<string | null>(null);
  const [strokes, setStrokes] = useState<Pt[][]>([]);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const drawing = useRef(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recRef = useRef<any>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const stopAll = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recRef.current?.stop();
    setSource(null);
    setPen(false);
    setFrozen(null);
    setStrokes([]);
    setListening(false);
  };

  useEffect(() => {
    if (!open) stopAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (v && source && streamRef.current) {
      v.srcObject = streamRef.current;
      void v.play().catch(() => {});
    }
  }, [source, pen]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const start = async (kind: Source) => {
    setError("");
    try {
      const s =
        kind === "screen"
          ? await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
          : await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      streamRef.current = s;
      s.getVideoTracks()[0]?.addEventListener("ended", stopAll);
      setSource(kind);
    } catch {
      setError(kind === "screen" ? "Screen sharing was cancelled or isn't supported here." : "Couldn't access the camera.");
    }
  };

  const openPen = async () => {
    const f = await captureFrom(videoRef.current);
    if (!f) {
      setError("The video hasn't started yet. Try again in a moment.");
      return;
    }
    setFrozen(f);
    setStrokes([]);
    setPen(true);
  };
  const closePen = () => {
    setPen(false);
    setFrozen(null);
    setStrokes([]);
  };

  const pt = (e: React.PointerEvent): Pt => {
    const b = svgRef.current!.getBoundingClientRect();
    return [
      Math.min(100, Math.max(0, ((e.clientX - b.left) / b.width) * 100)),
      Math.min(100, Math.max(0, ((e.clientY - b.top) / b.height) * 100)),
    ];
  };
  const down = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    drawing.current = true;
    setStrokes((s) => [...s, [pt(e)]]);
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const p = pt(e);
    setStrokes((s) => s.map((st, i) => (i === s.length - 1 ? [...st, p] : st)));
  };
  const up = () => {
    drawing.current = false;
  };

  const send = async (override?: string) => {
    const q = (override ?? text).trim();
    if (!q || busy) return;
    let images: string[];
    let hint: string;
    if (pen && frozen) {
      if (strokes.length) {
        const m = await markedFrame(frozen, strokes);
        images = [m.full, m.close];
        hint = PEN_HINT;
      } else {
        images = [frozen];
        hint = CALL_HINT;
      }
      closePen();
    } else {
      const f = await captureFrom(videoRef.current);
      images = f ? [f] : [];
      hint = images.length ? CALL_HINT : "";
    }
    setText("");
    onSend({ text: q, images, hint });
  };

  const toggleMic = () => {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const C = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!C) {
      setError("Voice input works in Chrome or Edge.");
      return;
    }
    const r = new C();
    r.interimResults = true;
    r.continuous = false;
    let final = "";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    r.onresult = (e: any) => {
      let s = "";
      for (let i = 0; i < e.results.length; i++) s += e.results[i][0].transcript;
      final = s;
      setText(s);
    };
    r.onend = () => {
      setListening(false);
      if (final.trim()) void send(final.trim());
    };
    r.onerror = () => setListening(false);
    recRef.current = r;
    r.start();
    setListening(true);
  };

  if (!open) return null;

  const last = messages[messages.length - 1];

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-3">
        <Logo className="size-6" />
        <span className="text-sm font-medium">Video call with Millie</span>
        {source && (
          <span className="ml-2 inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-xs text-primary">
            <span className="size-1.5 animate-pulse rounded-full bg-primary" />
            Sharing is on · {source === "screen" ? "screen" : "camera"}
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            disabled={!source}
            onClick={() => (pen ? closePen() : void openPen())}
            aria-label="Pen"
            title="Pen: mark the exact thing you mean"
            className={cn(pen && "text-primary")}
          >
            <PenLine className="size-4" />
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => {
              stopAll();
              onClose();
            }}
          >
            <PhoneOff className="size-4" /> End
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {/* Left: what Millie sees */}
        <div className="flex min-h-[38vh] items-center justify-center bg-black/90 p-3 md:basis-3/5">
          {!source ? (
            <div className="max-w-sm text-center text-white">
              <Logo className="mx-auto mb-4 size-12" />
              <p className="mb-5 text-sm text-white/80">
                Choose what Millie can see. It only sees what you share, and only while this call is on.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
                <Button onClick={() => void start("screen")}>
                  <Monitor className="size-4" /> Share my screen
                </Button>
                <Button variant="outline" className="bg-transparent text-white hover:bg-white/10" onClick={() => void start("camera")}>
                  <Camera className="size-4" /> Use my camera
                </Button>
              </div>
              {error && <p className="mt-3 text-xs text-red-300">{error}</p>}
            </div>
          ) : pen && frozen ? (
            <div className="flex max-h-full flex-col items-center gap-2">
              <div className="relative w-fit max-w-full">
                <img src={frozen} alt="Frozen frame" className="block max-h-[56vh] max-w-full rounded-md" draggable={false} />
                <svg
                  ref={svgRef}
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  className="absolute inset-0 size-full cursor-crosshair touch-none"
                  onPointerDown={down}
                  onPointerMove={move}
                  onPointerUp={up}
                  onPointerLeave={up}
                >
                  {strokes.map((st, i) => (
                    <polyline
                      key={i}
                      points={st.map((p) => p.join(",")).join(" ")}
                      fill="none"
                      stroke="#d946ef"
                      strokeWidth={3.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      vectorEffect="non-scaling-stroke"
                    />
                  ))}
                </svg>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-white/80">
                <span>Circle or draw on the exact thing you mean, then ask.</span>
                <Button size="sm" variant="outline" className="h-7 bg-transparent text-white hover:bg-white/10" onClick={() => setStrokes([])}>
                  <Trash2 className="size-3.5" /> Clear
                </Button>
                <Button size="sm" variant="outline" className="h-7 bg-transparent text-white hover:bg-white/10" onClick={closePen}>
                  <X className="size-3.5" /> Cancel
                </Button>
              </div>
            </div>
          ) : (
            <video ref={videoRef} muted playsInline className="max-h-full max-w-full rounded-md object-contain" />
          )}
        </div>

        {/* Right: conversation */}
        <div className="flex min-h-0 flex-1 flex-col border-t border-border md:border-l md:border-t-0">
          <div className="flex-1 space-y-5 overflow-y-auto p-4">
            {messages.length === 0 && (
              <p className="pt-6 text-center text-sm text-muted-foreground">
                Ask Millie about what you're sharing. Type, or tap the mic and talk.
              </p>
            )}
            {messages.map((m) =>
              m.role === "user" ? (
                <div key={m.id} className="ml-auto w-fit max-w-[85%] rounded-2xl bg-bubble px-3.5 py-2 text-sm text-bubble-foreground">
                  {m.images?.map((src, i) => <img key={i} src={src} alt="" className="mb-2 max-h-32 rounded-lg" />)}
                  <p className="whitespace-pre-wrap">{m.content}</p>
                </div>
              ) : (
                <div key={m.id} className="prose-millie text-sm">
                  <Markdown>{m.content}</Markdown>
                </div>
              ),
            )}
            {busy && last?.role === "user" && <p className="animate-pulse text-sm text-muted-foreground">Thinking…</p>}
            <div ref={endRef} />
          </div>
          <div className="border-t border-border p-3">
            <div className="flex items-end gap-1.5 rounded-2xl border border-border bg-card p-1.5">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
                rows={1}
                placeholder={pen ? "Ask about the marked area…" : "Ask about what you're sharing…"}
                className="max-h-32 min-h-9 flex-1 resize-none bg-transparent px-2.5 py-2 text-sm outline-none placeholder:text-muted-foreground"
              />
              <Button variant="ghost" size="icon" onClick={toggleMic} aria-label={listening ? "Stop listening" : "Talk to Millie"}>
                {listening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
              </Button>
              <Button size="icon" onClick={() => void send()} disabled={busy || !text.trim()} aria-label="Send">
                <Send className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
