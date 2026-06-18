import { cn } from "@/lib/utils";
import { Clock } from "lucide-react";

export function CountdownBadge({ days }: { days: number | null }) {
  if (days === null) return null;
  const expired = days < 0;
  const urgent = !expired && days <= 7;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
        expired
          ? "border-destructive/40 bg-destructive/10 text-destructive"
          : urgent
            ? "border-[hsl(var(--gold))]/50 bg-[hsl(var(--gold))]/10 text-[hsl(var(--gold))]"
            : "border-border bg-muted text-muted-foreground",
      )}
    >
      <Clock className="h-3 w-3" />
      {expired
        ? "Cerrado"
        : days === 0
          ? "Cierra hoy"
          : days === 1
            ? "Cierra mañana"
            : `Cierra en ${days}d`}
    </span>
  );
}
