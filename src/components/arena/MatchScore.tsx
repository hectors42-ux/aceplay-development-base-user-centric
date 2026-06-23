import { cn } from "@/lib/utils";

export interface MatchSet {
  a: number;
  b: number;
}

export interface MatchScoreProps {
  sets: MatchSet[];
  winner?: "a" | "b";
  labels?: { a: string; b: string };
  className?: string;
}

// Marcador de partido. Mono (DM Mono) para alinear dígitos por set. El lado
// ganador se resalta con confirm (verde); el otro queda en foreground neutro.
export function MatchScore({ sets, winner, labels, className }: MatchScoreProps) {
  return (
    <div className={cn("inline-flex flex-col gap-1 font-mono text-sm", className)} role="group" aria-label="Marcador del partido">
      {(["a", "b"] as const).map((side) => (
        <div
          key={side}
          className={cn(
            "flex items-center gap-3",
            winner && winner === side ? "font-bold text-confirm" : "text-foreground",
          )}
        >
          {labels && <span className="w-20 truncate text-xs">{labels[side]}</span>}
          <span className="flex gap-2">
            {sets.map((s, i) => (
              <span key={i} className="w-4 text-center tabular-nums">{side === "a" ? s.a : s.b}</span>
            ))}
          </span>
        </div>
      ))}
    </div>
  );
}
