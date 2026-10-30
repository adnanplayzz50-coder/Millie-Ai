import { cn } from "@/lib/utils";

/** Millie mark: hollow circle with three concentric sound-wave arcs to its left. */
export function Logo({ className, strokeWidth = 3 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      className={cn("text-primary", className)}
      aria-label="Millie logo"
      role="img"
    >
      <g transform="translate(2.24 2.24) scale(0.93)">
        <circle cx="41" cy="32" r="9" />
        <path d="M27.9 41.2 A16 16 0 0 1 27.9 22.8" />
        <path d="M23 44.6 A22 22 0 0 1 23 19.4" />
        <path d="M18.1 48.1 A28 28 0 0 1 18.1 15.9" />
      </g>
    </svg>
  );
}
