import { useMemo, useState } from "react";
import { format, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import { Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLadderAvailability, type DaySlot } from "@/hooks/useLadderAvailability";

interface Props {
  tenantId: string;
  surface: string;
  windowDays: number;
  /** Slots seleccionados (ISO). El padre controla. */
  value: string[];
  onChange: (next: string[]) => void;
  max?: number;
}

const bandOf = (d: Date): "manana" | "tarde" | "noche" => {
  const h = d.getHours();
  if (h < 12) return "manana";
  if (h < 18) return "tarde";
  return "noche";
};
const BAND_LABEL: Record<string, string> = {
  manana: "Mañana",
  tarde: "Tarde",
  noche: "Noche",
};

export const SlotPickerCalendar = ({
  tenantId,
  surface,
  windowDays,
  value,
  onChange,
  max = 3,
}: Props) => {
  const { data: buckets = [], isLoading } = useLadderAvailability({
    tenantId,
    surface,
    windowDays,
  });

  const [activeDayTs, setActiveDayTs] = useState<number | null>(null);

  // Default: primer día con disponibilidad
  const activeDay = useMemo(() => {
    if (activeDayTs !== null) {
      const found = buckets.find((b) => b.date.getTime() === activeDayTs);
      if (found) return found;
    }
    return buckets.find((b) => b.totalAvailable > 0) ?? buckets[0] ?? null;
  }, [buckets, activeDayTs]);

  const groupedSlots = useMemo(() => {
    if (!activeDay) return { manana: [], tarde: [], noche: [] } as Record<string, DaySlot[]>;
    const out: Record<string, DaySlot[]> = { manana: [], tarde: [], noche: [] };
    for (const s of activeDay.slots) out[bandOf(s.startsAt)].push(s);
    return out;
  }, [activeDay]);

  const valueSet = useMemo(() => new Set(value), [value]);

  const toggle = (s: DaySlot) => {
    if (s.availableCount === 0) return;
    const iso = s.startsAt.toISOString();
    if (valueSet.has(iso)) {
      onChange(value.filter((v) => v !== iso));
    } else {
      if (value.length >= max) return;
      onChange([...value, iso]);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  if (buckets.length === 0 || buckets.every((b) => b.totalAvailable === 0)) {
    return (
      <p className="rounded-2xl border border-dashed border-border bg-card/50 p-6 text-center text-xs text-muted-foreground">
        No hay canchas disponibles en la ventana de respuesta. Intenta más tarde.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/* Días: tira horizontal estilo iOS */}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-none snap-x snap-mandatory">
        {buckets.map((b) => {
          const isActive = activeDay && isSameDay(b.date, activeDay.date);
          const disabled = b.totalAvailable === 0;
          return (
            <button
              key={b.date.toISOString()}
              type="button"
              onClick={() => setActiveDayTs(b.date.getTime())}
              disabled={disabled}
              className={cn(
                "flex w-16 shrink-0 snap-start flex-col items-center gap-0.5 rounded-2xl border px-2 py-2 text-center transition-smooth",
                isActive
                  ? "border-primary bg-primary text-primary-foreground shadow-clay"
                  : disabled
                    ? "border-border bg-muted/40 text-muted-foreground/50"
                    : "border-border bg-card hover:border-primary/40",
              )}
            >
              <span className="text-[10px] uppercase tracking-wider opacity-80">
                {format(b.date, "EEE", { locale: es })}
              </span>
              <span className="font-display text-lg font-semibold leading-none">
                {format(b.date, "d")}
              </span>
              <span className="mt-0.5 text-[9px] opacity-80">
                {disabled ? "0 libres" : `${b.totalAvailable}`}
              </span>
            </button>
          );
        })}
      </div>

      {/* Slots agrupados por franja */}
      {activeDay && (
        <div className="space-y-3">
          {(["manana", "tarde", "noche"] as const).map((band) => {
            const arr = groupedSlots[band];
            if (arr.length === 0) return null;
            return (
              <div key={band}>
                <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {BAND_LABEL[band]}
                </p>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                  {arr.map((s) => {
                    const iso = s.startsAt.toISOString();
                    const selected = valueSet.has(iso);
                    const taken = s.availableCount === 0;
                    const limitReached = !selected && value.length >= max;
                    return (
                      <button
                        key={iso}
                        type="button"
                        onClick={() => toggle(s)}
                        disabled={taken || limitReached}
                        className={cn(
                          "relative rounded-2xl border px-2 py-2 text-center text-xs font-medium transition-smooth",
                          selected
                            ? "border-primary bg-primary text-primary-foreground shadow-clay"
                            : taken
                              ? "border-border bg-muted/40 text-muted-foreground/40 line-through"
                              : limitReached
                                ? "border-border bg-card text-muted-foreground/60"
                                : "border-border bg-card hover:border-primary/40 hover:bg-primary/5",
                        )}
                        aria-pressed={selected}
                      >
                        {format(s.startsAt, "HH:mm")}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Seleccionados */}
      {value.length > 0 && (
        <div className="rounded-2xl border border-border bg-muted/30 p-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Seleccionados ({value.length}/{max})
          </p>
          <ul className="space-y-1.5">
            {value
              .map((iso) => new Date(iso))
              .sort((a, b) => a.getTime() - b.getTime())
              .map((d) => (
                <li
                  key={d.toISOString()}
                  className="flex items-center justify-between gap-2 rounded-xl bg-card px-3 py-1.5 text-xs"
                >
                  <span className="font-medium">
                    {format(d, "EEE d MMM · HH:mm 'h'", { locale: es })}
                  </span>
                  <button
                    type="button"
                    onClick={() => onChange(value.filter((v) => v !== d.toISOString()))}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label="Quitar horario"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
};
