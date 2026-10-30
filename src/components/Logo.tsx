import { cn } from "@/lib/utils";

/** Millie logo using the user's original transparent hollow-logo image. */
export function Logo({ className }: { className?: string; strokeWidth?: number }) {
  return (
    <img
      src="/favicon-hollow.png"
      alt="Millie"
      className={cn("scale-[1.05]", className)}
      draggable={false}
    />
  );
}
