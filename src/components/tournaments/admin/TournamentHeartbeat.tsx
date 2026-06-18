import { RingAnimated, useCountUp } from "@/components/feedback";

interface Props {
  pct: number;
  daysLeft: number | null;
  matchesPlayed: number;
  matchesTotal: number;
}

export function TournamentHeartbeat({ pct, daysLeft, matchesPlayed, matchesTotal }: Props) {
  const animPct = useCountUp(pct, { duration: 1100 });
  const animDays = useCountUp(daysLeft ?? 0, { duration: 700 });
  return (
    <div className="rounded-2xl border border-border bg-gradient-to-br from-card to-muted/30 p-5">
      <div className="flex items-center gap-5">
        <div className="pop-in relative shrink-0" style={{ width: 140, height: 140 }}>
          <RingAnimated pct={pct} size={140} stroke={12} />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="count-pop font-display text-4xl font-semibold tabular-nums text-primary">
              {animPct}
              <span className="text-xl text-muted-foreground">%</span>
            </div>
            <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.32em] text-muted-foreground">
              Jugado
            </div>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-muted-foreground">
            Latido del torneo
          </div>
          {daysLeft !== null && daysLeft >= 0 ? (
            <div className="mt-1 font-display text-2xl font-semibold leading-tight">
              Quedan <em className="italic text-primary">{animDays} {daysLeft === 1 ? "día" : "días"}</em>
            </div>
          ) : (
            <div className="mt-1 font-display text-2xl font-semibold leading-tight">
              {matchesPlayed} de {matchesTotal} <em className="italic text-primary">partidos</em>
            </div>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            {matchesPlayed} de {matchesTotal} partidos jugados.
          </p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-700"
              style={{ width: `${pct}%`, background: "var(--gradient-clay)" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}