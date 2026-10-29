import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Brain, Chrome, Monitor, Palette, Smartphone, Cpu, Cloud } from "lucide-react";
import { useApp } from "@/components/app/AppProvider";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useHideExChats } from "@/hooks/use-hide-ex-chats";
import { downloadExtension } from "@/lib/extension-download";

const AI_MODE_KEY = "millie-ai-mode";
const OLLAMA_MODEL_KEY = "millie-ollama-model";

export function SettingsSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { user, setCustomizeOpen } = useApp();
  const navigate = useNavigate();
  const [hideEx, setHideEx] = useHideExChats();
  const [aiMode, setAiMode] = useState<"online" | "local">("online");
  const [ollamaModel, setOllamaModel] = useState("llama3.2");
  const [ollamaUrl, setOllamaUrl] = useState("http://localhost:11434");

  useEffect(() => {
    try {
      const mode = localStorage.getItem(AI_MODE_KEY);
      if (mode === "local" || mode === "online") setAiMode(mode);
      setOllamaModel(localStorage.getItem(OLLAMA_MODEL_KEY) || "llama3.2");
      setOllamaUrl(localStorage.getItem("millie-ollama-url") || "http://localhost:11434");
    } catch {
      // Settings remain at safe defaults if storage is unavailable.
    }
  }, [open]);

  const saveAiSettings = (mode: "online" | "local", model = ollamaModel, url = ollamaUrl) => {
    setAiMode(mode);
    setOllamaModel(model);
    setOllamaUrl(url);
    try {
      localStorage.setItem(AI_MODE_KEY, mode);
      localStorage.setItem(OLLAMA_MODEL_KEY, model.trim() || "llama3.2");
      localStorage.setItem("millie-ollama-url", url.trim().replace(/\/$/, "") || "http://localhost:11434");
    } catch {
      // The active session can still use the chosen mode even if it cannot persist.
    }
    window.dispatchEvent(new CustomEvent("millie-ai-mode-changed", { detail: { mode } }));
  };

  const go = (to: "/account" | "/memory") => {
    navigate({ to });
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Settings</SheetTitle>
          <SheetDescription>Your account, chats, memory and apps.</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-8">
          <section className="space-y-2">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Account</h3>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
              <span className="truncate text-sm">{user.email}</span>
              <Button variant="outline" size="sm" onClick={() => go("/account")}>Edit account</Button>
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">AI provider</h3>
            <div className="rounded-xl border border-border p-3 space-y-3">
              <div className="flex items-center gap-3">
                {aiMode === "local" ? <Cpu className="size-5 text-primary" /> : <Cloud className="size-5 text-primary" />}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{aiMode === "local" ? "Local AI" : "Online AI"}</p>
                  <p className="text-xs text-muted-foreground">
                    {aiMode === "local" ? "Chat requests go to Ollama on this device." : "Uses Millie's existing hosted AI providers."}
                  </p>
                </div>
                <Switch
                  checked={aiMode === "local"}
                  onCheckedChange={(checked) => saveAiSettings(checked ? "local" : "online")}
                  aria-label="Use local AI instead of online AI"
                />
              </div>
              {aiMode === "local" && (
                <div className="space-y-3 border-t border-border pt-3">
                  <label className="block space-y-1">
                    <span className="text-xs font-medium">Ollama model name</span>
                    <input value={ollamaModel} onChange={(e) => saveAiSettings("local", e.target.value, ollamaUrl)} placeholder="llama3.2" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs font-medium">Ollama address</span>
                    <input value={ollamaUrl} onChange={(e) => saveAiSettings("local", ollamaModel, e.target.value)} placeholder="http://localhost:11434" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Local mode requires Ollama running on this same computer, with the selected model downloaded. The first request may need browser access to localhost.
                  </p>
                  <Button variant="outline" size="sm" onClick={async () => {
                    try {
                      const base = ollamaUrl.trim().replace(/\/$/, "") || "http://localhost:11434";
                      const response = await fetch(base + "/api/tags");
                      if (!response.ok) throw new Error("Ollama returned " + response.status);
                      const data = await response.json();
                      const models = (data.models ?? []).map((m: { name: string }) => m.name).join(", ");
                      window.alert("Ollama is reachable. Installed models: " + (models || "none found"));
                    } catch (error) {
                      window.alert("Could not reach Ollama. Install/start Ollama, check the address, and allow this website's origin in OLLAMA_ORIGINS. " + (error instanceof Error ? error.message : ""));
                    }
                  }}>Test local connection</Button>
                </div>
              )}
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Chats</h3>
            <div className="flex items-center justify-between gap-4 rounded-xl border border-border p-3">
              <div>
                <p className="text-sm font-medium">Hide Ex-Chats</p>
                <p className="text-xs text-muted-foreground">Hides the older chats category. Turns on by itself when the Millie extension is installed and signed in.</p>
              </div>
              <Switch checked={hideEx} onCheckedChange={setHideEx} aria-label="Hide Ex-Chats" />
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Memory and look</h3>
            <div className="grid gap-2">
              <Button variant="outline" className="justify-start gap-2 bg-transparent" onClick={() => go("/memory")}><Brain className="size-4" /> Memory</Button>
              <Button variant="outline" className="justify-start gap-2 bg-transparent" onClick={() => { setCustomizeOpen(true); onOpenChange(false); }}><Palette className="size-4" /> Customize</Button>
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Our Apps</h3>
            <div className="space-y-2">
              <AppRow icon={<Chrome className="size-5" />} title="Chrome extension" subtitle="Chat with Millie from your toolbar, and talk about your screen." action={<Button size="sm" onClick={async () => { const ok = await downloadExtension(); if (ok) setTimeout(() => { onOpenChange(false); navigate({ to: "/extension-setup" }); }, 1000); }}>Download</Button>} />
              <AppRow icon={<Monitor className="size-5" />} title="Windows app" subtitle="Millie on your desktop." action={<ComingSoon />} />
              <AppRow icon={<Smartphone className="size-5" />} title="Android and iOS" subtitle="Millie on your phone." action={<ComingSoon />} />
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function AppRow({ icon, title, subtitle, action }: { icon: React.ReactNode; title: string; subtitle: string; action: React.ReactNode }) {
  return <div className="flex items-center gap-3 rounded-xl border border-border p-3"><div className="text-muted-foreground">{icon}</div><div className="min-w-0 flex-1"><p className="text-sm font-medium">{title}</p><p className="text-xs text-muted-foreground">{subtitle}</p></div>{action}</div>;
}

function ComingSoon() {
  return <span className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">Coming soon</span>;
}
