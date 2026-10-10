import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/components/app/AppProvider";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

const QUESTIONS = [
  { key: "hobbies", label: "What are your hobbies?", ph: "Hiking, baking sourdough, chess…" },
  { key: "interests", label: "What are you interested in?", ph: "Space, design, history of jazz…" },
  { key: "ai_use", label: "What will you use Millie for?", ph: "Writing, coding side projects, studying…" },
] as const;

/** Optional first-run questions. Skip is always available. */
export function OnboardingDialog() {
  const { profile, user, refreshProfile } = useApp();
  const [vals, setVals] = useState({ hobbies: "", interests: "", ai_use: "" });
  const [busy, setBusy] = useState(false);
  const open = !!profile && !profile.onboarded;

  const finish = async (save: boolean) => {
    setBusy(true);
    await supabase
      .from("profiles")
      .update({ onboarded: true, ...(save ? vals : {}) })
      .eq("id", user.id);
    setBusy(false);
    refreshProfile();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && finish(false)}>
      <DialogContent className="sm:max-w-lg">
        <div className="flex flex-col items-center text-center">
          <Logo className="size-12" />
          <DialogTitle className="font-read mt-3 text-2xl font-normal">Nice to meet you</DialogTitle>
          <DialogDescription>A few optional questions so Millie can feel a bit more yours.</DialogDescription>
        </div>
        <div className="space-y-4">
          {QUESTIONS.map((q) => (
            <label key={q.key} className="block space-y-1.5 text-sm">
              <span>{q.label}</span>
              <Textarea
                rows={2}
                placeholder={q.ph}
                value={vals[q.key]}
                onChange={(e) => setVals((v) => ({ ...v, [q.key]: e.target.value }))}
              />
            </label>
          ))}
        </div>
        <div className="flex justify-between gap-2">
          <Button variant="ghost" onClick={() => finish(false)} disabled={busy}>
            Skip
          </Button>
          <Button onClick={() => finish(true)} disabled={busy}>
            Save & start
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
