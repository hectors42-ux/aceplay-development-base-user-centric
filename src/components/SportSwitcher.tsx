import { useActiveSport, type ActiveSport } from "@/components/providers/SportProvider";
import { cn } from "@/lib/utils";

interface SportSwitcherProps {
  className?: string;
  /** Si el club aún no tiene canchas/torneos de pádel, igual mostramos el switch para perfil/ranking. */
  compact?: boolean;
}

const OPTIONS: { value: ActiveSport; label: string }[] = [
  { value: "tenis", label: "Tenis" },
  { value: "padel", label: "Pádel" },
];

/**
 * Pill segmentado para alternar deporte activo. Minimalista, 32px de alto,
 * pensado para vivir en el AppHeader (mobile) y en el sidebar (desktop).
 */
export const SportSwitcher = ({ className, compact = false }: SportSwitcherProps) => {
  const { sport, setSport } = useActiveSport();

  return (
    <div
      role="tablist"
      aria-label="Deporte"
      className={cn(
        "inline-flex items-center rounded-full border border-border/60 bg-muted/60 p-0.5 shadow-sm",
        compact ? "text-[11px]" : "text-xs",
        className,
      )}
    >
      {OPTIONS.map((opt) => {
        const active = sport === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => setSport(opt.value)}
            className={cn(
              "rounded-full px-3 py-1 font-medium uppercase tracking-[0.12em] transition-smooth",
              compact ? "py-0.5" : "py-1",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
};
