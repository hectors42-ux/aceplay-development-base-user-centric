import { useActiveSport } from "@/components/providers/SportProvider";
import { cn } from "@/lib/utils";

interface SportBadgeProps {
  className?: string;
}

/**
 * Chip de solo lectura que muestra el deporte activo (TENIS / PÁDEL).
 * Pensado para vivir en el header de todas las páginas internas y mantener
 * continuidad visual con el SportSwitcher de la Home.
 */
export const SportBadge = ({ className }: SportBadgeProps) => {
  const { sport } = useActiveSport();
  const label = sport === "padel" ? "Pádel" : "Tenis";

  return (
    <span
      role="status"
      aria-label={`Deporte activo: ${label}`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary shadow-sm",
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
      {label}
    </span>
  );
};
