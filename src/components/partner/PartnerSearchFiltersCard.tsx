import { Sparkles, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { MatchType, PartnerFilters, SurfaceFilter } from "@/hooks/useMatchSearchFilters";

interface Props {
  myLevel: number | null;
  filters: PartnerFilters;
  setFilters: (patch: Partial<PartnerFilters>) => void;
  candidateCount: number;
  loading: boolean;
  onStart: () => void;
  onEditAvailability: () => void;
}

const MATCH_TYPES: { value: MatchType; label: string }[] = [
  { value: "singles", label: "Singles" },
  { value: "dobles", label: "Dobles" },
  { value: "cualquiera", label: "Cualquiera" },
];

const SURFACES: { value: SurfaceFilter; label: string }[] = [
  { value: "arcilla", label: "Arcilla" },
  { value: "cemento", label: "Cemento" },
  { value: "cualquiera", label: "Cualquiera" },
];

export const PartnerSearchFiltersCard = ({
  myLevel,
  filters,
  setFilters,
  candidateCount,
  loading,
  onStart,
  onEditAvailability,
}: Props) => {
  const minL = myLevel != null ? Math.max(0, myLevel - filters.level_delta) : null;
  const maxL = myLevel != null ? myLevel + filters.level_delta : null;

  return (
    <div className="rounded-3xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Buscar partido
        </span>
      </div>
      <h3 className="mt-2 font-display text-xl font-semibold tracking-tight">
        Encuentra niveles compatibles
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Define tus preferencias y desliza por los socios sugeridos.
      </p>

      {/* Tipo de partido */}
      <section className="mt-5">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Tipo de partido
        </p>
        <div className="grid grid-cols-3 gap-1.5">
          {MATCH_TYPES.map((m) => {
            const active = filters.match_type === m.value;
            return (
              <button
                key={m.value}
                type="button"
                onClick={() => setFilters({ match_type: m.value })}
                className={cn(
                  "rounded-xl border px-2 py-2 text-xs font-medium transition-smooth",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background hover:bg-muted",
                )}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* Rango de nivel */}
      <section className="mt-5">
        <div className="mb-2 flex items-baseline justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Rango de nivel
          </p>
          <p className="text-[10px] text-muted-foreground">
            {myLevel != null ? `Tu UTR ${myLevel.toFixed(2)}` : "Sin rating"}
          </p>
        </div>
        <Slider
          value={[filters.level_delta]}
          min={0.2}
          max={3}
          step={0.1}
          onValueChange={(v) => setFilters({ level_delta: v[0] })}
        />
        <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
          <span>UTR {minL?.toFixed(2) ?? "—"}</span>
          <span>± {filters.level_delta.toFixed(1)}</span>
          <span>UTR {maxL?.toFixed(2) ?? "—"}</span>
        </div>
      </section>

      {/* Toggles */}
      <section className="mt-5 space-y-2">
        {[
          { key: "active_30d" as const, label: "Jugadores activos (últimos 30 días)" },
          { key: "not_played_yet" as const, label: "Que aún no he enfrentado" },
          { key: "same_category" as const, label: "De mi categoría" },
        ].map((t) => (
          <div
            key={t.key}
            className="flex items-center justify-between rounded-xl border border-border bg-background px-3 py-2.5"
          >
            <span className="text-xs">{t.label}</span>
            <Switch
              checked={filters[t.key]}
              onCheckedChange={(v) => setFilters({ [t.key]: v } as Partial<PartnerFilters>)}
            />
          </div>
        ))}
      </section>

      {/* Superficie */}
      <section className="mt-5">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Superficie
        </p>
        <div className="grid grid-cols-3 gap-1.5">
          {SURFACES.map((s) => {
            const active = filters.surface === s.value;
            return (
              <button
                key={s.value}
                type="button"
                onClick={() => setFilters({ surface: s.value })}
                className={cn(
                  "rounded-xl border px-2 py-1.5 text-[11px] font-medium transition-smooth",
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background hover:bg-muted",
                )}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </section>

      <Button
        variant="clay"
        className="mt-6 h-12 w-full text-sm font-semibold"
        onClick={onStart}
        disabled={loading}
      >
        <Sparkles className="mr-2 h-4 w-4" />
        Empezar a buscar · {candidateCount} jugador{candidateCount === 1 ? "" : "es"}
      </Button>

      <button
        type="button"
        onClick={onEditAvailability}
        className="mt-3 flex w-full items-center justify-center gap-1.5 text-[11px] font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
      >
        <Calendar className="h-3 w-3" />
        Editar mi disponibilidad horaria
      </button>
    </div>
  );
};
