import { useEffect, useState } from "react";
import { Check, Copy, Cpu, Download, Loader2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  LOCAL_DEFAULTS,
  detectPlatform,
  hasModel,
  listModels,
  probeOllama,
  pullModel,
  setLocalAi,
  useLocalAi,
} from "@/lib/local-ai";

type Status = "off" | "checking" | "unreachable" | "blocked" | "pulling" | "ready" | "error";

function CommandBox({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-start gap-2 rounded-lg bg-muted p-2">
      <code className="min-w-0 flex-1 whitespace-pre-wrap break-all text-xs">{text}</code>
      <Button
        variant="ghost"
        size="icon"
        className="size-7 shrink-0"
        aria-label="Copy"
        onClick={() => {
          void navigator.clipboard?.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      </Button>
    </div>
  );
}

export function LocalAiSettings() {
  const cfg = useLocalAi();
  const platform = detectPlatform();
  const mobile = platform === "android" || platform === "ios";
  const origin = typeof window === "undefined" ? "" : window.location.origin;

  const [status, setStatus] = useState<Status>("off");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [draftModel, setDraftModel] = useState(cfg.model);
  const [draftHost, setDraftHost] = useState(cfg.host);

  // While the switch is on, keep checking. Once Ollama is installed and running, the model
  // downloads by itself, so there is nothing else to press.
  useEffect(() => {
    if (!cfg.enabled) {
      setStatus("off");
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const ctrl = new AbortController();

    const step = async () => {
      const state = await probeOllama(cfg.host);
      if (cancelled) return;
      if (state !== "ready") {
        setStatus(state);
        timer = setTimeout(step, 4000);
        return;
      }
      try {
        const installed = await listModels(cfg.host);
        if (cancelled) return;
        if (!hasModel(installed, cfg.model)) {
          setProgress(0);
          setStatus("pulling");
          await pullModel(cfg.host, cfg.model, (p) => !cancelled && setProgress(p), ctrl.signal);
        }
        if (!cancelled) setStatus("ready");
      } catch (e) {
        if (cancelled) return;
        setError((e as Error).message);
        setStatus("error");
      }
    };

    setStatus("checking");
    void step();
    return () => {
      cancelled = true;
      ctrl.abort();
      clearTimeout(timer);
    };
  }, [cfg.enabled, cfg.host, cfg.model, attempt]);

  const saveAdvanced = () => {
    setLocalAi({
      model: draftModel.trim() || LOCAL_DEFAULTS.model,
      host: draftHost.trim().replace(/\/+$/, "") || LOCAL_DEFAULTS.host,
    });
  };

  return (
    <section className="space-y-2">
      <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Local AI</h3>
      <div className="space-y-3 rounded-xl border border-border p-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Cpu className="mt-0.5 size-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Local (Ollama)</p>
              <p className="text-xs text-muted-foreground">
                Millie answers with Ollama instead of the online AI, even when you have internet. It also works with no
                internet. Chats are not saved to your account while this is on.
              </p>
            </div>
          </div>
          <Switch checked={cfg.enabled} onCheckedChange={(v) => setLocalAi({ enabled: v })} aria-label="Use Local AI" />
        </div>

        {cfg.enabled && (
          <div className="space-y-2 text-sm">
            {status === "checking" && (
              <p className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Looking for Ollama…
              </p>
            )}

            {status === "unreachable" && mobile && (
              <div className="space-y-2">
                <p className="flex items-start gap-2">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-400" />
                  <span>
                    Ollama can't run on {platform === "ios" ? "iPhone or iPad" : "Android"}. To use Local from this
                    device, run Ollama on a computer and put its secure (https) address under Advanced. Otherwise,
                    turn Local off.
                  </span>
                </p>
              </div>
            )}

            {status === "unreachable" && !mobile && (
              <div className="space-y-2">
                <p className="flex items-start gap-2">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-400" />
                  <span>
                    Ollama isn't running on this device. Install it, then open it. I keep checking, and I'll download the
                    model as soon as it's running.
                  </span>
                </p>
                <Button asChild size="sm" className="gap-2">
                  <a href="https://ollama.com/download" target="_blank" rel="noreferrer">
                    <Download className="size-4" /> Download Ollama
                  </a>
                </Button>
                <p className="text-xs text-muted-foreground">
                  If your browser asks to allow access to devices on your network, choose Allow. Safari may block this
                  entirely, so use Chrome, Edge, Brave or Firefox.
                </p>
              </div>
            )}

            {status === "blocked" && (
              <div className="space-y-2">
                <p className="flex items-start gap-2">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-400" />
                  <span>Ollama is running, but it isn't allowing this site yet. Run this, then restart Ollama:</span>
                </p>
                {platform === "windows" && <CommandBox text={`setx OLLAMA_ORIGINS "${origin}"`} />}
                {platform === "mac" && <CommandBox text={`launchctl setenv OLLAMA_ORIGINS "${origin}"`} />}
                {platform === "linux" && (
                  <>
                    <CommandBox text="sudo systemctl edit ollama" />
                    <CommandBox text={`[Service]\nEnvironment="OLLAMA_ORIGINS=${origin}"`} />
                    <CommandBox text="sudo systemctl restart ollama" />
                  </>
                )}
                {mobile && (
                  <CommandBox text={`On the computer running Ollama, set OLLAMA_ORIGINS to ${origin} and restart it.`} />
                )}
                <p className="text-xs text-muted-foreground">
                  {platform === "windows" && "Use Command Prompt, then quit Ollama from the system tray and open it again."}
                  {platform === "mac" && "Use Terminal, then quit Ollama from the menu bar and open it again."}
                </p>
              </div>
            )}

            {status === "pulling" && (
              <div className="space-y-1.5">
                <p className="flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" /> Downloading {cfg.model}… {progress}%
                </p>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                </div>
                <p className="text-xs text-muted-foreground">This only happens once. Keep this page open.</p>
              </div>
            )}

            {status === "ready" && (
              <p className="flex items-center gap-2 text-emerald-400">
                <Check className="size-4" /> Ready. Millie is using {cfg.model}.
              </p>
            )}

            {status === "error" && (
              <div className="space-y-2">
                <p className="flex items-start gap-2">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-400" />
                  <span>{error}</span>
                </p>
                <Button size="sm" variant="outline" onClick={() => setAttempt((n) => n + 1)}>
                  Try again
                </Button>
              </div>
            )}
          </div>
        )}

        <details className="text-sm">
          <summary className="cursor-pointer text-xs text-muted-foreground">Advanced</summary>
          <div className="mt-2 space-y-2">
            <label className="block text-xs text-muted-foreground">Model</label>
            <input
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={draftModel}
              onChange={(e) => setDraftModel(e.target.value)}
            />
            <label className="block text-xs text-muted-foreground">Ollama address</label>
            <input
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={draftHost}
              onChange={(e) => setDraftHost(e.target.value)}
            />
            <Button size="sm" variant="outline" onClick={saveAdvanced}>
              Save
            </Button>
          </div>
        </details>
      </div>
    </section>
  );
}