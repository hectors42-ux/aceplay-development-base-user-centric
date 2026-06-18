import { useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { HeatmapCell } from "@/hooks/analytics/useAnalyticsOccupancy";

const DAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

interface HeatmapGridProps {
  data: HeatmapCell[] | undefined;
  loading?: boolean;
  startHour?: number;
  endHour?: number;
}

export function HeatmapGrid({ data, loading, startHour = 8, endHour = 22 }: HeatmapGridProps) {
  const hours = useMemo(
    () => Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i),
    [startHour, endHour],
  );

  const grid = useMemo(() => {
    const map = new Map<string, number>();
    let max = 0;
    (data ?? []).forEach((c) => {
      const key = `${c.weekday}-${c.hour}`;
      const next = (map.get(key) ?? 0) + Number(c.occupied_count);
      map.set(key, next);
      if (next > max) max = next;
    });
    return { map, max };
  }, [data]);

  if (loading) {
    return <Skeleton className="h-64 w-full rounded-2xl" />;
  }

  return (
    <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      <div
        className="grid gap-1 text-[10px]"
        style={{ gridTemplateColumns: `1.75rem repeat(7, minmax(2rem, 1fr))`, minWidth: "20rem" }}
      >
        <div />
        {DAY_LABELS.map((d) => (
          <div key={d} className="text-center font-medium text-muted-foreground">{d}</div>
        ))}
        {hours.map((h) => (
          <div key={`row-${h}`} className="contents">
            <div className="pr-1 text-right text-muted-foreground tabular-nums">{h}h</div>
            {DAY_LABELS.map((_, dayIdx) => {
              const weekday = dayIdx + 1;
              const value = grid.map.get(`${weekday}-${h}`) ?? 0;
              const intensity = grid.max > 0 ? value / grid.max : 0;
              return (
                <Tooltip key={`${weekday}-${h}`}>
                  <TooltipTrigger asChild>
                    <div
                      className={cn(
                        "h-7 rounded-md border border-border/40 transition-colors",
                        value === 0 ? "bg-muted/40" : "",
                      )}
                      style={
                        value > 0
                          ? { backgroundColor: `hsl(var(--primary) / ${0.15 + intensity * 0.7})` }
                          : undefined
                      }
                      aria-label={`${DAY_LABELS[dayIdx]} ${h}:00 — ${value} reservas`}
                    />
                  </TooltipTrigger>
                  <TooltipContent className="text-xs">
                    {DAY_LABELS[dayIdx]} {h}:00 · <strong>{value}</strong> reservas
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
