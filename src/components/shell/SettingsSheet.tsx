import { useNavigate } from "@tanstack/react-router";
import { Brain, Chrome, Monitor, Palette, Smartphone } from "lucide-react";
import { useApp } from "@/components/app/AppProvider";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useHideExChats } from "@/hooks/use-hide-ex-chats";

/** Where the Chrome extension zip is hosted on the website (public/millie-extension.zip). */
const EXTENSION_ZIP_URL = "/millie-extension.zip";

export function SettingsSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { user, setCustomizeOpen } = useApp();
  const navigate = useNavigate();
  const [hideEx, setHideEx] = useHideExChats();

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
              <Button variant="outline" size="sm" onClick={() => go("/account")}>
                Edit account
              </Button>
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Chats</h3>
            <div className="flex items-center justify-between gap-4 rounded-xl border border-border p-3">
              <div>
                <p className="text-sm font-medium">Hide Ex-Chats</p>
                <p className="text-xs text-muted-foreground">
                  Hides the older chats category. Turns on by itself when the Millie extension is installed and signed in.
                </p>
              </div>
              <Switch checked={hideEx} onCheckedChange={setHideEx} aria-label="Hide Ex-Chats" />
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Memory and look</h3>
            <div className="grid gap-2">
              <Button variant="outline" className="justify-start gap-2 bg-transparent" onClick={() => go("/memory")}>
                <Brain className="size-4" /> Memory
              </Button>
              <Button
                variant="outline"
                className="justify-start gap-2 bg-transparent"
                onClick={() => {
                  setCustomizeOpen(true);
                  onOpenChange(false);
                }}
              >
                <Palette className="size-4" /> Customize
              </Button>
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Our Apps</h3>
            <div className="space-y-2">
              <AppRow
                icon={<Chrome className="size-5" />}
                title="Chrome extension"
                subtitle="Chat with Millie from your toolbar, and talk about your screen."
                action={
                  <a
                    href={EXTENSION_ZIP_URL}
                    download="millie-extension.zip"
                    onClick={() => {
                      // Let the download start, then take the user to the install steps.
                      setTimeout(() => {
                        onOpenChange(false);
                        navigate({ to: "/extension-setup" });
                      }, 1000);
                    }}
                    className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:opacity-90"
                  >
                    Download
                  </a>
                }
              />
              <AppRow
                icon={<Monitor className="size-5" />}
                title="Windows app"
                subtitle="Millie on your desktop."
                action={<ComingSoon />}
              />
              <AppRow
                icon={<Smartphone className="size-5" />}
                title="Android and iOS"
                subtitle="Millie on your phone."
                action={<ComingSoon />}
              />
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function AppRow({ icon, title, subtitle, action }: { icon: React.ReactNode; title: string; subtitle: string; action: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border p-3">
      <div className="text-muted-foreground">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

function ComingSoon() {
  return <span className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">Coming soon</span>;
}
