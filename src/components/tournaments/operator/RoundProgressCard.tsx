import { useEffect, useState } from "react";
import { useCountUp } from "@/components/feedback";
import { cn } from "@/lib/utils";

interface Props {
  roundLabel: string;
  categoryName: string;
  closed: number;
  total: number;
  /** Inicio de la ronda (created_at o started_at). Si falta, no se muestra countdown. */
  roundStartedAt?: string | null;
  /** Minutos promedio por match (default 25 si no se pasa). */
  avgMatchMinutes?: number | null;
}

function useRoundCountdown(roundStartedAt?: string | null, avgMatchMinutes?: number | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!roundStartedAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [roundStartedAt]);
  if (!roundStartedAt) return null;
  const avg = avgMatchMinutes ?? 25;
  const startMs = new Date(roundStartedAt).getTime();
  if (Number.isNaN(startMs)) return null;
  const elapsedMs = now - startMs;
  const remainingMs = avg * 60_000 - elapsedMs;
  const over = remainingMs < 0;
  const absSec = Math.floor(Math.abs(remainingMs) / 1000);
  const mm = String(Math.floor(absSec / 60)).padStart(2, "0");
  const ss = String(absSec % 60).padStart(2, "0");
  return { label: `${mm}:${ss}`, over };
}

export function RoundProgressCard({
  roundLabel,
  categoryName,
  closed,
  total,
  roundStartedAt,
  avgMatchMinutes,
}: Props) {
  const pct = total === 0 ? 0 : Math.round((closed / total) * 100);
  const animClosed = useCountUp(closed, { duration: 700 });
  const countdown = useRoundCountdown(roundStartedAt, avgMatchMinutes);

  return (
    <section className="rounded-2xl border border-border bg-gradient-to-br from-card to-muted/30 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-muted-foreground">
            {categoryName}
          </p>
          <h2 className="mt-1 font-display text-2xl font-semibold leading-tight">
            {roundLabel}
          </h2>
        </div>
        <div className="text-right">
          <p className="font-display text-3xl font-semibold tabular-nums text-primary">
            {animClosed}
            <span className="text-base text-muted-foreground">/{total}</span>
          </p>
          <p className="font-mono text-[9px] uppercase tracking-[0.32em] text-muted-foreground">
            canchas cerradas
          </p>
          {countdown && (
            <p
              className={cn(
                "mt-1 font-mono text-[11px] tabular-nums",
                countdown.over ? "text-warning" : "text-muted-foreground",
              )}
            >
              {countdown.over
                ? `+${countdown.label} sobre tiempo`
                : `${countdown.label} estimado`}
            </p>
          )}
        </div>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all duration-700")}
          style={{ width: `${pct}%`, background: "var(--gradient-clay)" }}
        />
      </div>
    </section>
  );
}