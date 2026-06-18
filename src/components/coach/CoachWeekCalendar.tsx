import { useMemo, useState } from "react";
import { addDays, startOfWeek, format, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight, User as UserIcon, Users, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CoachClassEnriched } from "@/hooks/useCoachClasses";

interface Props {
  classes: CoachClassEnriched[];
  onSelect?: (cls: CoachClassEnriched) => void;
}

const HOUR_START = 8;
const HOUR_END = 22;
const HOURS = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);

export const CoachWeekCalendar = ({ classes, onSelect }: Props) => {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  const classesByDay = useMemo(() => {
    const map = new Map<string, CoachClassEnriched[]>();
    for (const c of classes) {
      const k = format(new Date(c.starts_at), "yyyy-MM-dd");
      const arr = map.get(k) ?? [];
      arr.push(c);
      map.set(k, arr);
    }
    return map;
  }, [classes]);

  const statusColor = (s: string) => {
    switch (s) {
      case "confirmada":
        return "bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-400";
      case "propuesta":
        return "bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-400";
      case "completada":
        return "bg-muted border-border text-muted-foreground";
      case "cancelada":
        return "bg-destructive/10 border-destructive/30 text-destructive line-through";
      default:
        return "bg-muted border-border";
    }
  };

  const kindIcon = (k: string) =>
    k === "externa" ? UserPlus : k === "socio_compartida" ? Users : UserIcon;

  return (
    <div className="rounded-2xl border border-border bg-card p-2 shadow-card">
      <div className="mb-2 flex items-center justify-between px-1">
        <p className="font-display text-sm font-semibold capitalize">
          {format(weekStart, "MMM yyyy", { locale: es })}
        </p>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-2"
            onClick={() => setWeekStart(addDays(weekStart, -7))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8"
            onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
          >
            Hoy
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-2"
            onClick={() => setWeekStart(addDays(weekStart, 7))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[640px]">
          {/* Header */}
          <div className="grid grid-cols-[40px_repeat(7,1fr)] gap-px border-b border-border pb-1">
            <div />
            {days.map((d) => {
              const isToday = isSameDay(d, new Date());
              return (
                <div key={d.toISOString()} className="text-center">
                  <p className="text-[10px] uppercase text-muted-foreground">
                    {format(d, "EEE", { locale: es })}
                  </p>
                  <p
                    className={cn(
                      "mx-auto mt-0.5 grid h-6 w-6 place-items-center rounded-full text-xs font-semibold",
                      isToday && "bg-primary text-primary-foreground",
                    )}
                  >
                    {format(d, "d")}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Grid */}
          <div className="relative grid grid-cols-[40px_repeat(7,1fr)] gap-px">
            {HOURS.map((h) => (
              <div key={`row-${h}`} className="contents">
                <div className="h-12 border-t border-border/50 pr-1 text-right text-[10px] text-muted-foreground">
                  {String(h).padStart(2, "0")}
                </div>
                {days.map((d) => (
                  <div
                    key={`${d.toISOString()}-${h}`}
                    className="h-12 border-l border-t border-border/50"
                  />
                ))}
              </div>
            ))}

            {/* Bloques de clases superpuestos */}
            {days.map((d, dayIdx) => {
              const k = format(d, "yyyy-MM-dd");
              const dayClasses = classesByDay.get(k) ?? [];
              return dayClasses.map((c) => {
                const start = new Date(c.starts_at);
                const end = new Date(c.ends_at);
                const startMin = start.getHours() * 60 + start.getMinutes();
                const endMin = end.getHours() * 60 + end.getMinutes();
                if (start.getHours() < HOUR_START || start.getHours() >= HOUR_END) return null;
                const top = ((startMin - HOUR_START * 60) / 60) * 48;
                const height = Math.max(20, ((endMin - startMin) / 60) * 48 - 2);
                const Icon = kindIcon(c.kind);
                return (
                  <button
                    key={c.id}
                    onClick={() => onSelect?.(c)}
                    style={{
                      top: `${top}px`,
                      height: `${height}px`,
                      left: `calc(40px + (100% - 40px) * ${dayIdx} / 7 + 1px)`,
                      width: `calc((100% - 40px) / 7 - 2px)`,
                    }}
                    className={cn(
                      "absolute overflow-hidden rounded-md border px-1 py-0.5 text-left text-[10px] leading-tight transition-smooth hover:scale-[1.02] hover:shadow-md",
                      statusColor(c.status),
                    )}
                    title={`${c.student1_name ?? "Externo"} · ${c.court_name}`}
                  >
                    <p className="flex items-center gap-0.5 font-semibold">
                      <Icon className="h-2.5 w-2.5 shrink-0" />
                      {format(start, "HH:mm")}
                    </p>
                    <p className="truncate">{c.student1_name ?? "Externo"}</p>
                    {c.student2_name && <p className="truncate">+{c.student2_name}</p>}
                    <p className="truncate opacity-70">{c.court_name}</p>
                  </button>
                );
              });
            })}
          </div>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-2 px-1 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm bg-emerald-500/60" /> Confirmada
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm bg-amber-500/60" /> Propuesta
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm bg-muted-foreground/40" /> Completada
        </span>
      </div>
    </div>
  );
};
