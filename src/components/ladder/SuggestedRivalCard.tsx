import { Swords, Clock, Calendar, Repeat, Sparkles, AlertTriangle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ChallengeablePlayer } from "@/hooks/useChallengeablePlayers";

const initials = (first: string | null, last: string | null) =>
  `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase() || "?";

const formatRelative = (iso: string | null) => {
  if (!iso) return "Sin partidos previos";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days < 1) return "Hoy";
  if (days < 7) return `Hace ${days}d`;
  if (days < 30) return `Hace ${Math.floor(days / 7)}sem`;
  return `Hace ${Math.floor(days / 30)}m`;
};

interface Props {
  player: ChallengeablePlayer;
  onChallenge: () => void;
  highlight?: boolean;
}

/**
 * Tarjeta de rival sugerido con score, motivos y CTA Desafiar.
 */
export const SuggestedRivalCard = ({ player, onChallenge, highlight }: Props) => {
  const scorePct = Math.round(player.score);
  return (
    <div
      className={cn(
        "rounded-2xl border bg-card p-3 shadow-card transition-smooth",
        highlight ? "border-accent/50 bg-accent/5" : "border-border",
      )}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-muted font-display text-xs font-bold">
          #{player.pos}
        </div>
        <Avatar className="h-9 w-9 shrink-0">
          <AvatarImage src={player.avatar_url ?? undefined} />
          <AvatarFallback className="text-[11px]">
            {initials(player.first_name, player.last_name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            {player.first_name} {player.last_name}
          </p>
          <p className="truncate text-[10px] text-muted-foreground">
            Nivel {player.level.toFixed(2)} · Δ {player.level_diff.toFixed(2)}
          </p>
        </div>
        <div className="flex flex-col items-end shrink-0">
          <span className="font-display text-lg font-bold leading-none text-primary">
            {scorePct}
          </span>
          <span className="text-[9px] uppercase tracking-wide text-muted-foreground">
            match
          </span>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {player.schedule_match && (
          <Badge variant="outline" className="h-4 gap-1 rounded-md border-accent/40 px-1.5 text-[9px] font-semibold text-accent">
            <Calendar className="h-3 w-3" /> Horarios
          </Badge>
        )}
        {player.rematch && (
          <Badge variant="outline" className="h-4 gap-1 rounded-md border-warning/40 px-1.5 text-[9px] font-semibold text-warning">
            <Repeat className="h-3 w-3" /> Revancha
          </Badge>
        )}
        {player.level_diff <= 0.3 && (
          <Badge variant="outline" className="h-4 gap-1 rounded-md border-success/40 px-1.5 text-[9px] font-semibold text-success">
            <Sparkles className="h-3 w-3" /> Pareja
          </Badge>
        )}
        <Badge variant="outline" className="h-4 gap-1 rounded-md px-1.5 text-[9px] font-semibold text-muted-foreground">
          <Clock className="h-3 w-3" /> {formatRelative(player.last_played_at)}
        </Badge>
      </div>

      <div className="mt-3 flex justify-end">
        <Button
          variant="clay"
          size="sm"
          onClick={onChallenge}
          disabled={player.cooldown_blocked}
          className="h-8 gap-1.5"
        >
          {player.cooldown_blocked ? (
            <>
              <AlertTriangle className="h-3.5 w-3.5" /> Cooldown
            </>
          ) : (
            <>
              <Swords className="h-3.5 w-3.5" /> Desafiar
            </>
          )}
        </Button>
      </div>
    </div>
  );
};
