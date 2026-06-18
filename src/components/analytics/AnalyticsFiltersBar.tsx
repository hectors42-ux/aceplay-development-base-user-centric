import { CalendarRange } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAnalyticsFilters, type DateRangePreset, type AnalyticsSport } from "@/hooks/analytics/useAnalyticsFilters";
import { cn } from "@/lib/utils";

const PRESETS: Array<{ value: DateRangePreset; label: string }> = [
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "mtd", label: "MTD" },
  { value: "90d", label: "90d" },
  { value: "ytd", label: "YTD" },
];

const SPORTS: Array<{ value: AnalyticsSport; label: string }> = [
  { value: "todos", label: "Todos" },
  { value: "tenis", label: "Tenis" },
  { value: "padel", label: "Pádel" },
];

export function AnalyticsFiltersBar() {
  const { preset, setPreset, from, to, sport, setSport } = useAnalyticsFilters();
  const fmt = (d: Date) => d.toLocaleDateString("es-CL", { day: "2-digit", month: "short" });

  return (
    <div className="-mx-4 flex flex-col gap-2 border-b border-border/60 bg-muted/30 px-4 py-2 md:-mx-6 md:px-6 sm:flex-row sm:items-center">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <CalendarRange className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{fmt(from)} → {fmt(to)}</span>
      </div>
      <div className="flex items-center gap-1 sm:ml-auto">
        {SPORTS.map((s) => (
          <Button
            key={s.value}
            size="sm"
            variant={sport === s.value ? "default" : "ghost"}
            onClick={() => setSport(s.value)}
            className={cn("h-7 px-2.5 text-xs", sport === s.value && "shadow-sm")}
          >
            {s.label}
          </Button>
        ))}
        <div className="mx-1 h-4 w-px bg-border" />
        {PRESETS.map((p) => (
          <Button
            key={p.value}
            size="sm"
            variant={preset === p.value ? "default" : "ghost"}
            onClick={() => setPreset(p.value)}
            className={cn("h-7 px-2.5 text-xs", preset === p.value && "shadow-sm")}
          >
            {p.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
