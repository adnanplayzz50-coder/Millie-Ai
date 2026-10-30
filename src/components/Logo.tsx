import { cn } from "@/lib/utils";

/** Uses the original Millie logo image asset throughout the app. */
export function Logo({ className }: { className?: string; strokeWidth?: number }) {
  return (
    <img
      src="/millie-logo-192.png"
      alt="Millie"
      className={cn("object-contain", className)}
      draggable={false}
    />
  );
}
