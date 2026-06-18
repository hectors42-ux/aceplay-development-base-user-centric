import { Crown, Medal } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { ClubRankingRow } from "@/hooks/useClubRanking";
import { formatLevel } from "@/lib/rating-utils";

interface Props {
  top3: ClubRankingRow[];
  currentUserId?: string;
  onSelect?: (userId: string) => void;
}

const initials = (first: string | null, last: string | null) =>
  `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase() || "?";

export const RankingPodium = ({ top3, currentUserId, onSelect }: Props) => {
  if (top3.length === 0) return null;

  // Order: 2nd | 1st | 3rd para look de podio clásico
  const second = top3[1];
  const first = top3[0];
  const third = top3[2];

  const Slot = ({
    row,
    height,
    rank,
  }: {
    row: ClubRankingRow | undefined;
    height: string;
    rank: 1 | 2 | 3;
  }) => {
    if (!row) return <div className="flex-1" />;
    const isMe = row.user_id === currentUserId;
    const ringColor =
      rank === 1
        ? "ring-warning"
        : rank === 2
          ? "ring-muted-foreground/40"
          : "ring-accent/60";
    const podiumBg =
      rank === 1
        ? "bg-gradient-clay"
        : rank === 2
          ? "bg-muted"
          : "bg-accent/20";
    const podiumLabel =
      rank === 1 ? (
        <Crown className="h-3.5 w-3.5" />
      ) : (
        <Medal className="h-3 w-3" />
      );
    return (
      <button
        type="button"
        onClick={() => onSelect?.(row.user_id)}
        className="flex flex-1 flex-col items-center gap-1.5 rounded-xl p-1 text-left transition-smooth hover:bg-muted/40"
      >
        <div className="relative">
          <Avatar className={cn("h-14 w-14 ring-2 ring-offset-2 ring-offset-background", ringColor)}>
            <AvatarImage src={row.avatar_url ?? undefined} />
            <AvatarFallback className="text-sm font-semibold">
              {initials(row.first_name, row.last_name)}
            </AvatarFallback>
          </Avatar>
          <span
            className={cn(
              "absolute -bottom-1 left-1/2 flex h-5 w-5 -translate-x-1/2 items-center justify-center rounded-full font-display text-[10px] font-bold shadow-card",
              rank === 1 ? "bg-warning text-warning-foreground" : "bg-card text-foreground border border-border",
            )}
          >
            {rank}
          </span>
        </div>
        <p className="line-clamp-1 text-center text-xs font-medium">
          {row.first_name} {row.last_name?.[0]}.
          {isMe && <span className="ml-1 text-[9px] font-bold text-primary">TÚ</span>}
        </p>
        <div
          className={cn(
            "flex w-full flex-col items-center justify-end rounded-t-2xl px-2 pt-2 pb-1.5 text-center",
            podiumBg,
            height,
            rank === 1 && "text-primary-foreground shadow-clay",
          )}
        >
          <span className="flex items-center gap-0.5 text-[10px] font-semibold uppercase tracking-wider opacity-80">
            {podiumLabel}
          </span>
          <span className="font-display text-lg font-bold leading-none">
            {formatLevel(row.level)}
          </span>
          <span className="text-[9px] uppercase tracking-wide opacity-70">nivel</span>
        </div>
      </button>
    );
  };

  return (
    <div className="rounded-3xl border border-border bg-card p-4 shadow-card">
      <div className="flex items-end gap-2">
        <Slot row={second} height="h-16" rank={2} />
        <Slot row={first} height="h-20" rank={1} />
        <Slot row={third} height="h-12" rank={3} />
      </div>
    </div>
  );
};
