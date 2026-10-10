import { X } from "lucide-react";
import { useApp } from "@/components/app/AppProvider";
import { useWakeState } from "./WakeWord";
import { cn } from "@/lib/utils";

/** Small indicator next to the logo while the wake word is active, with an off switch. */
export function WakeIndicator() {
  const state = useWakeState();
  const { updateSettings } = useApp();
  if (state === "off") return null;
  return (
    <span
      className={cn(
        "flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground",
        state === "listening" && "border-primary text-primary",
      )}
      title='Listening for "Hey Millie"'
    >
      <span className={cn("size-1.5 rounded-full bg-primary", state === "listening" ? "animate-ping" : "animate-pulse")} />
      {state === "listening" ? "Listening..." : "Hey Millie"}
      <button onClick={() => updateSettings({ wake_word: false })} aria-label="Turn off wake word" className="hover:text-foreground">
        <X className="size-3" />
      </button>
    </span>
  );
}
