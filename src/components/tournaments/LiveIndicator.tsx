import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface LiveIndicatorProps {
  lastUpdatedAt: Date | null;
  refreshing?: boolean;
  className?: string;
}

function relativeTime(date: Date): string {
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 5) return "ahora";
  if (seconds < 60) return `hace ${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `hace ${hours} h`;
}

export const LiveIndicator = ({
  lastUpdatedAt,
  refreshing = false,
  className,
}: LiveIndicatorProps) => {
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-emerald-700 dark:text-emerald-400",
        className,
      )}
      aria-live="polite"
      role="status"
      title="Esta vista se actualiza automáticamente cada 30 segundos"
    >
      <span className="relative flex h-2 w-2">
        <span
          className={cn(
            "absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75",
            refreshing ? "animate-ping" : "animate-pulse",
          )}
        />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      <span>En vivo</span>
      <span className="text-emerald-700/70 dark:text-emerald-400/70 normal-case tracking-normal">
        · {refreshing ? "actualizando…" : lastUpdatedAt ? relativeTime(lastUpdatedAt) : "—"}
      </span>
    </div>
  );
};
