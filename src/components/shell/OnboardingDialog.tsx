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

/** Optional first-run questions. Closing or skipping must never trap the user. */
export function OnboardingDialog() {
  const { profile, user, refreshProfile } = useApp();
  const [vals, setVals] = useState({ hobbies: "", interests: "", ai_use: "" });
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const open = !!profile && !profile.onboarded && !dismissed;

  const finish = async (save: boolean) => {
    if (busy) return;

    // Close immediately so a slow or failed database request cannot trap the user.
    setDismissed(true);
    setBusy(true);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ onboarded: true, ...(save ? vals : {}) })
        .eq("id", user.id);

      if (error) {
        console.error("Could not save onboarding preferences:", error.message);
        if (save) {
          window.alert("Millie couldn't save your answers. You can continue using Millie; please try again later.");
        }
      }

      await refreshProfile();
    } catch (error) {
      console.error("Could not finish onboarding:", error);
      if (save) {
        window.alert("Millie couldn't save your answers. You can continue using Millie; please try again later.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) void finish(false);
      }}
    >
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
          <Button type="button" variant="ghost" onClick={() => void finish(false)} disabled={busy}>
            Skip
          </Button>
          <Button type="button" onClick={() => void finish(true)} disabled={busy}>
            {busy ? "Saving…" : "Save & start"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
