import { Trophy, Zap } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useMatchOfTheWeek } from "@/hooks/useMatchOfTheWeek";
import { formatLevel } from "@/lib/rating-utils";
import { cn } from "@/lib/utils";

const initials = (name?: string) =>
  (name ?? "?")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

export const MatchOfTheWeekCard = () => {
  const { items, loading } = useMatchOfTheWeek();
  if (loading || items.length === 0) return null;

  return (
    <section className="px-5" aria-labelledby="motw-titulo">
      <h2
        id="motw-titulo"
        className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground"
      >
        Match de la semana
      </h2>
      <div className="-mx-5 overflow-x-auto scrollbar-none">
        <div className="flex snap-x snap-mandatory gap-3 px-5 pb-1">
          {items.map((m) => {
            const isClosest = m.kind === "closest";
            const Icon = isClosest ? Trophy : Zap;
            const accent = isClosest
              ? "from-primary/15 to-primary/5 border-primary/30"
              : "from-warning/15 to-warning/5 border-warning/30";
            const winnerIsA = m.winner_id === m.player_a_id;
            return (
              <div
                key={m.id}
                className={cn(
                  "w-[82%] shrink-0 snap-start rounded-3xl border bg-gradient-to-br p-4 shadow-card",
                  accent,
                )}
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-background/70 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider backdrop-blur-sm">
                    <Icon className="h-3 w-3" strokeWidth={2.5} />
                    {m.highlight_label}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-1 flex-col items-center gap-1.5 text-center">
                    <Avatar
                      className={cn(
                        "h-12 w-12 ring-2 ring-offset-2 ring-offset-background",
                        winnerIsA ? "ring-success" : "ring-muted",
                      )}
                    >
                      <AvatarImage src={m.player_a_avatar ?? undefined} />
                      <AvatarFallback className="text-xs">
                        {initials(m.player_a_name)}
                      </AvatarFallback>
                    </Avatar>
                    <p className="line-clamp-1 text-xs font-medium">
                      {m.player_a_name}
                    </p>
                    <span className="text-[10px] text-muted-foreground">
                      {m.level_a !== null ? formatLevel(Number(m.level_a)) : "—"}
                    </span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <span className="font-display text-lg font-bold text-muted-foreground">
                      VS
                    </span>
                    {m.level_diff !== null && (
                      <span className="text-[9px] uppercase text-muted-foreground">
                        Δ {Number(m.level_diff).toFixed(2)}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col items-center gap-1.5 text-center">
                    <Avatar
                      className={cn(
                        "h-12 w-12 ring-2 ring-offset-2 ring-offset-background",
                        !winnerIsA ? "ring-success" : "ring-muted",
                      )}
                    >
                      <AvatarImage src={m.player_b_avatar ?? undefined} />
                      <AvatarFallback className="text-xs">
                        {initials(m.player_b_name)}
                      </AvatarFallback>
                    </Avatar>
                    <p className="line-clamp-1 text-xs font-medium">
                      {m.player_b_name}
                    </p>
                    <span className="text-[10px] text-muted-foreground">
                      {m.level_b !== null ? formatLevel(Number(m.level_b)) : "—"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
