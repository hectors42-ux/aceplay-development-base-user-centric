import { cn } from "@/lib/utils";

export interface LiveBadgeProps {
  label?: string;
  className?: string;
}

// EN VIVO = rol ACTION (naranja #EC6E2E) por G. El punto pulsa con motion-safe;
// con reduce-motion queda fijo (sin ping).
export function LiveBadge({ label = "EN VIVO", className }: LiveBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-action/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-action",
        className,
      )}
    >
      <span className="relative flex h-2 w-2" aria-hidden>
        <span className="absolute inline-flex h-full w-full rounded-full bg-action opacity-70 motion-safe:animate-ping motion-reduce:hidden" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-action" />
      </span>
      {label}
    </span>
  );
}
