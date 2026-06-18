import { Trophy, Sparkles } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { SuggestedMatchup } from "@/hooks/useSuggestedMatchup";

const initials = (first?: string | null, last?: string | null) =>
  `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase() || "?";

interface Props {
  matchup: SuggestedMatchup;
}

/**
 * Tarjeta destacando el matchup más equilibrado de la semana del club.
 */
export const MatchupOfTheWeekCard = ({ matchup }: Props) => {
  const a = matchup.player_a;
  const b = matchup.player_b;
  return (
    <div className="rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-accent/5 p-4 shadow-clay">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Sparkles className="h-3.5 w-3.5" />
        </span>
        <div>
          <p className="font-display text-sm font-bold">Reta de la semana</p>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Emparejamiento más equilibrado del club
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="flex flex-1 flex-col items-center gap-1.5">
          <Avatar className="h-12 w-12 border-2 border-primary/30">
            <AvatarImage src={a?.avatar_url ?? undefined} />
            <AvatarFallback>{initials(a?.first_name, a?.last_name)}</AvatarFallback>
          </Avatar>
          <p className="text-center text-xs font-medium">
            {a?.first_name} {a?.last_name?.[0] ?? ""}.
          </p>
          <p className="text-[10px] text-muted-foreground">
            {matchup.level_a?.toFixed(2) ?? "—"}
          </p>
        </div>

        <div className="flex flex-col items-center px-2">
          <Trophy className="h-5 w-5 text-primary" />
          <span className="mt-1 font-display text-xs font-bold uppercase tracking-wider text-primary">
            VS
          </span>
          <span className="mt-0.5 text-[10px] text-muted-foreground">
            Δ {matchup.level_diff?.toFixed(2) ?? "0"}
          </span>
        </div>

        <div className="flex flex-1 flex-col items-center gap-1.5">
          <Avatar className="h-12 w-12 border-2 border-accent/30">
            <AvatarImage src={b?.avatar_url ?? undefined} />
            <AvatarFallback>{initials(b?.first_name, b?.last_name)}</AvatarFallback>
          </Avatar>
          <p className="text-center text-xs font-medium">
            {b?.first_name} {b?.last_name?.[0] ?? ""}.
          </p>
          <p className="text-[10px] text-muted-foreground">
            {matchup.level_b?.toFixed(2) ?? "—"}
          </p>
        </div>
      </div>

      {matchup.reason && (
        <p className="mt-3 text-center text-[10px] text-muted-foreground">
          {matchup.reason}
        </p>
      )}
    </div>
  );
};
