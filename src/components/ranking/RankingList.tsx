import { ArrowDown, ArrowUp, Flame, Minus, Snowflake } from "lucide-react";
import { UserAvatar } from "@/components/avatar/UserAvatar";
import { cn, formatStreakLabel } from "@/lib/utils";
import type { ClubRankingRow } from "@/hooks/useClubRanking";
import { formatLevel } from "@/lib/rating-utils";
import { InviteRowAction } from "./InviteRowAction";
import type { InviteRowState } from "@/hooks/useInviteRowStates";

interface Props {
  rows: ClubRankingRow[];
  currentUserId?: string;
  startIndex?: number; // útil cuando viene después del podio
  onSelect?: (userId: string) => void;
  onInvite?: (row: ClubRankingRow) => void;
  /**
   * Mapa de estado de invitación por user_id (pending/accepted/rejected/expired).
   * Si está presente, se usa para renderizar la pill de estado en cada fila.
   */
  inviteStateByUserId?: Map<string, InviteRowState>;
  /** Legacy: set de user_ids con invitación pendiente vigente. Se usa si no llega `inviteStateByUserId`. */
  pendingInviteeIds?: Set<string>;
}

const initials = (first: string | null, last: string | null) =>
  `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase() || "?";

const PositionDelta = ({ current, prev }: { current: number; prev: number | null }) => {
  if (prev === null || prev === current) {
    return (
      <span className="flex items-center text-[10px] text-muted-foreground">
        <Minus className="h-2.5 w-2.5" />
      </span>
    );
  }
  const diff = prev - current; // positivo = subió posiciones
  if (diff > 0) {
    return (
      <span className="flex items-center gap-0.5 text-[10px] font-semibold text-success">
        <ArrowUp className="h-2.5 w-2.5" />
        {diff}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-0.5 text-[10px] font-semibold text-destructive">
      <ArrowDown className="h-2.5 w-2.5" />
      {Math.abs(diff)}
    </span>
  );
};

const StreakBadge = ({ streak }: { streak: number }) => {
  if (streak === 0) return null;
  if (streak >= 3) {
    return (
      <span
        className="inline-flex items-center gap-0.5 rounded-full bg-warning/10 px-1.5 py-0.5 text-[9px] font-semibold text-warning"
        title={formatStreakLabel(streak)}
      >
        <Flame className="h-2.5 w-2.5" />
        {streak}
      </span>
    );
  }
  if (streak <= -3) {
    return (
      <span
        className="inline-flex items-center gap-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground"
        title={formatStreakLabel(streak)}
      >
        <Snowflake className="h-2.5 w-2.5" />
        {Math.abs(streak)}
      </span>
    );
  }
  return null;
};

const CategoryBadge = ({ category }: { category: string | null }) => {
  if (!category) return null;
  const map: Record<string, string> = {
    A: "bg-primary/10 text-primary",
    B: "bg-accent/20 text-accent-foreground",
    C: "bg-muted text-muted-foreground",
    "Sin categoría": "bg-muted/50 text-muted-foreground/70",
  };
  const cls = map[category] ?? "bg-muted text-muted-foreground";
  return (
    <span className={cn("inline-flex h-4 items-center rounded-md px-1.5 text-[9px] font-semibold", cls)}>
      {category}
    </span>
  );
};

export const RankingList = ({ rows, currentUserId, startIndex = 0, onSelect, onInvite, inviteStateByUserId, pendingInviteeIds }: Props) => {
  if (rows.length === 0) return null;
  return (
    <ul className="space-y-1.5">
      {rows.map((row) => {
        const isMe = row.user_id === currentUserId;
        return (
          <li key={row.user_id}>
            <div
              className={cn(
                "flex h-[68px] w-full items-center gap-2.5 rounded-2xl border bg-card px-2.5 transition-smooth hover:bg-muted/40",
                isMe
                  ? "border-primary bg-primary/5 shadow-clay"
                  : "border-border shadow-card",
              )}
            >
              <button
                type="button"
                onClick={() => onSelect?.(row.user_id)}
                className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
              >
                <div className="flex w-8 shrink-0 flex-col items-center">
                  <span className="font-display text-sm font-bold leading-none">
                    #{row.rank_position}
                  </span>
                  <PositionDelta current={row.rank_position} prev={row.prev_rank_position} />
                </div>
                <UserAvatar kind={row.avatar_kind} look={row.avatar_look} url={row.avatar_url}
                  name={`${row.first_name ?? ""} ${row.last_name ?? ""}`} className="h-9 w-9" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="min-w-0 flex-1 truncate text-sm font-medium">
                      {row.first_name} {row.last_name}
                    </p>
                    {isMe && (
                      <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider text-primary">
                        Tú
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex h-4 items-center gap-1.5 overflow-hidden">
                    <CategoryBadge category={row.category} />
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {row.matches_played} {row.matches_played === 1 ? "partido" : "partidos"}
                    </span>
                    <StreakBadge streak={row.streak} />
                  </div>
                </div>
                <div className="flex w-12 shrink-0 flex-col items-end">
                  <span className="font-display text-base font-bold leading-none">
                    {formatLevel(row.level)}
                  </span>
                  <span className="mt-0.5 text-[9px] uppercase tracking-wide text-muted-foreground">
                    nivel
                  </span>
                </div>
              </button>
              {onInvite && !isMe && (() => {
                const explicitState = inviteStateByUserId?.get(row.user_id);
                const fallbackPending = pendingInviteeIds?.has(row.user_id);
                const state: InviteRowState | undefined =
                  explicitState ??
                  (fallbackPending
                    ? { kind: "pending", expiresAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString() }
                    : undefined);
                return (
                  <InviteRowAction
                    firstName={row.first_name}
                    state={state}
                    onInvite={() => onInvite(row)}
                  />
                );
              })()}
            </div>
          </li>
        );
      })}
    </ul>
  );
};
