import { ArrowLeftRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PlayerLite, RoundMatch } from "@/hooks/useRoundPairs";

interface Props {
  match: RoundMatch;
  courtLabel: string;
  players: Map<string, PlayerLite>;
  selectedUserId: string | null;
  selectedMatchId: string | null;
  onTapPlayer: (matchId: string, userId: string) => void;
  disabledUserIds?: Set<string>;
  locked?: boolean; // partido en juego / finalizado
}

function nameOf(p?: PlayerLite) {
  if (!p) return "—";
  const first = (p.first_name ?? "").trim();
  const last = (p.last_name ?? "").trim();
  if (!first && !last) return "—";
  return `${first}${last ? ` ${last[0]}.` : ""}`;
}

export function CourtPairCard({
  match,
  courtLabel,
  players,
  selectedUserId,
  selectedMatchId,
  onTapPlayer,
  disabledUserIds,
  locked,
}: Props) {
  const editing = selectedMatchId === match.id;
  const sideA = match.side_a_user_ids ?? [];
  const sideB = match.side_b_user_ids ?? [];

  const renderPlayer = (uid: string | undefined, idx: number) => {
    if (!uid) {
      return (
        <div key={idx} className="rounded-md border border-dashed border-border p-2 text-xs text-muted-foreground">
          (vacío)
        </div>
      );
    }
    const isSelected = selectedUserId === uid;
    const isDisabled = locked || disabledUserIds?.has(uid);
    return (
      <button
        key={uid}
        type="button"
        disabled={isDisabled}
        onClick={() => onTapPlayer(match.id, uid)}
        className={cn(
          "flex items-center gap-1.5 rounded-md border px-2.5 py-2 text-left text-sm transition",
          "min-h-[44px]",
          isSelected
            ? "border-primary bg-primary/10 text-primary"
            : "border-border bg-background hover:bg-muted/40",
          isDisabled && "cursor-not-allowed opacity-40",
        )}
        aria-label={`Jugador ${nameOf(players.get(uid))}`}
      >
        <span className={cn("h-1.5 w-1.5 rounded-full", isSelected ? "bg-primary" : "bg-muted-foreground/50")} />
        <span className="truncate">{nameOf(players.get(uid))}</span>
        {isSelected && <ArrowLeftRight className="ml-auto h-3.5 w-3.5" />}
      </button>
    );
  };

  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-3 transition",
        editing
          ? "border-primary shadow-[0_0_0_3px_hsl(var(--primary)/0.15)] motion-reduce:shadow-none"
          : "border-border",
        locked && "opacity-60",
      )}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.32em] text-muted-foreground">
          {courtLabel}
        </span>
        {locked && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
            En juego — no editable
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {renderPlayer(sideA[0], 0)}
        {renderPlayer(sideB[0], 1)}
        {renderPlayer(sideA[1], 2)}
        {renderPlayer(sideB[1], 3)}
      </div>
      {editing && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <ArrowLeftRight className="h-3 w-3" />
          Toca otro jugador para intercambiar.
        </p>
      )}
    </div>
  );
}