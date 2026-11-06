import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string; strokeWidth?: number }) {
  return (
    <img
      src="/icon-512.png"
      alt="Millie"
      className={cn("object-contain", className)}
      draggable={false}
    />
  );
}
