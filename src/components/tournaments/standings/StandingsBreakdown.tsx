import { useEffect, useState } from "react";

interface Stat {
  label: string;
  value: number;
  weight: number;
}

interface Props {
  matchesWon: number;
  setsWon: number;
  gamesWon: number;
  stbGamesWon: number;
  weights: { matches: number; sets: number; games: number; stb: number };
  total: number;
}

export function StandingsBreakdown({
  matchesWon,
  setsWon,
  gamesWon,
  stbGamesWon,
  weights,
  total,
}: Props) {
  const stats: Stat[] = [
    { label: "Partidos", value: matchesWon, weight: weights.matches },
    { label: "Sets", value: setsWon, weight: weights.sets },
    { label: "Juegos", value: gamesWon, weight: weights.games },
    { label: "STB", value: stbGamesWon, weight: weights.stb },
  ];

  const max = Math.max(0.0001, ...stats.map((s) => s.value * s.weight));
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div className="space-y-2.5 px-3 py-3 text-[11px] text-muted-foreground tnum">
      {stats.map((s) => {
        const contribution = s.value * s.weight;
        const pct = mounted ? Math.min(100, (contribution / max) * 100) : 0;
        return (
          <div key={s.label}>
            <div className="flex justify-between">
              <span>{s.label}</span>
              <span className="font-mono">
                +{contribution.toFixed(3)}{" "}
                <span className="text-muted-foreground/60">({s.value} × {s.weight})</span>
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{
                  width: `${pct}%`,
                  transition: "width 600ms cubic-bezier(.32,.72,0,1)",
                }}
              />
            </div>
          </div>
        );
      })}
      <div className="mt-1 flex items-center justify-between border-t border-border pt-1.5 text-foreground">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          = {weights.matches}·PG + {weights.sets}·S + {weights.games}·J + {weights.stb}·STB
        </span>
        <span className="count-pop font-display text-sm font-semibold">
          {total.toFixed(3)}
        </span>
      </div>
    </div>
  );
}