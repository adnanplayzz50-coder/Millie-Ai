import { Check, Monitor, Moon, Sun } from "lucide-react";
import { useApp } from "@/components/app/AppProvider";
import { FONTS, PALETTES, type ThemeKey } from "@/lib/theme";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

const THEMES: { key: ThemeKey; label: string; icon: typeof Sun }[] = [
  { key: "light", label: "Light", icon: Sun },
  { key: "dark", label: "Dark", icon: Moon },
  { key: "system", label: "System", icon: Monitor },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-xs font-medium tracking-wider text-muted-foreground uppercase">{title}</h3>
      {children}
    </section>
  );
}

export function CustomizeSheet() {
  const { customizeOpen, setCustomizeOpen, settings, updateSettings } = useApp();
  return (
    <Sheet open={customizeOpen} onOpenChange={setCustomizeOpen}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="font-read text-2xl font-normal">Customize</SheetTitle>
          <SheetDescription>Changes preview live and save to your account.</SheetDescription>
        </SheetHeader>
        <div className="space-y-8 px-4 pb-8">
          <Section title="Theme">
            <div className="grid grid-cols-3 gap-2">
              {THEMES.map((t) => (
                <button
                  key={t.key}
                  onClick={() => updateSettings({ theme: t.key })}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-lg border p-3 text-sm transition-all",
                    settings.theme === t.key ? "border-primary bg-accent" : "hover:border-primary/50",
                  )}
                >
                  <t.icon className="size-4" />
                  {t.label}
                </button>
              ))}
            </div>
          </Section>

          <Section title="Accent palette">
            <div className="grid grid-cols-3 gap-2">
              {PALETTES.map((p) => {
                const active = settings.palette === p.key && !settings.custom_color;
                return (
                  <button
                    key={p.key}
                    onClick={() => updateSettings({ palette: p.key, custom_color: null })}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-lg border p-3 text-xs transition-all",
                      active ? "border-primary bg-accent" : "hover:border-primary/50",
                    )}
                  >
                    <span className="relative size-8 rounded-full" style={{ background: p.swatch }}>
                      {active && <Check className="absolute inset-0 m-auto size-4 text-primary-foreground" />}
                    </span>
                    {p.label}
                  </button>
                );
              })}
            </div>
            <label className="flex items-center justify-between rounded-lg border p-3 text-sm">
              <span>Custom color</span>
              <span className="flex items-center gap-2">
                {settings.custom_color && (
                  <button className="text-xs text-muted-foreground underline" onClick={() => updateSettings({ custom_color: null })}>
                    Reset
                  </button>
                )}
                <input
                  type="color"
                  value={settings.custom_color ?? "#8b5cf6"}
                  onChange={(e) => updateSettings({ custom_color: e.target.value })}
                  className="size-8 cursor-pointer rounded border-0 bg-transparent"
                />
              </span>
            </label>
          </Section>

          <Section title="Font">
            <div className="space-y-2">
              {FONTS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => updateSettings({ font: f.key })}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition-all",
                    settings.font === f.key ? "border-primary bg-accent" : "hover:border-primary/50",
                  )}
                >
                  <span>
                    <span className="block text-lg" style={{ fontFamily: f.family }}>
                      {f.label}
                    </span>
                    <span className="text-xs text-muted-foreground">{f.sample}</span>
                  </span>
                  {settings.font === f.key && <Check className="size-4 text-primary" />}
                </button>
              ))}
            </div>
          </Section>

          <Section title="Voice">
            <div className="space-y-3 rounded-lg border p-4">
              <label className="flex items-center justify-between text-sm">
                Read replies aloud
                <Switch checked={settings.read_aloud} onCheckedChange={(v) => updateSettings({ read_aloud: v })} />
              </label>
              <label className="flex items-center justify-between text-sm">
                “Hey Millie” wake word
                <Switch checked={settings.wake_word} onCheckedChange={(v) => updateSettings({ wake_word: v })} />
              </label>
              <p className="text-xs leading-relaxed text-muted-foreground">
                The wake word only works while this tab is open in Chrome or Edge, pauses when the tab is hidden, and
                audio may be sent to your browser's speech service. Turn it off here or from the indicator next to the
                logo.
              </p>
            </div>
          </Section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
