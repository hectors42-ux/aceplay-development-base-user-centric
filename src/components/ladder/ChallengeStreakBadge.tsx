import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  current: number;
  longest: number;
  className?: string;
}

/**
 * Badge con la racha de retas semanales del usuario.
 */
export const ChallengeStreakBadge = ({ current, longest, className }: Props) => {
  if (current === 0) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-2xl border border-dashed border-border bg-card/50 px-3 py-2 text-xs text-muted-foreground",
          className,
        )}
      >
        <Flame className="h-3.5 w-3.5" />
        <span>
          Lanza tu primer desafío de la semana para empezar tu racha
        </span>
      </div>
    );
  }
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-2xl border border-warning/30 bg-warning/5 px-3 py-2",
        className,
      )}
    >
      <Flame className="h-4 w-4 text-warning" />
      <div className="flex-1">
        <p className="text-xs font-semibold">
          🔥 {current} {current === 1 ? "semana" : "semanas"} retando
        </p>
        <p className="text-[10px] text-muted-foreground">
          Tu mejor racha: {longest} {longest === 1 ? "semana" : "semanas"}
        </p>
      </div>
    </div>
  );
};
