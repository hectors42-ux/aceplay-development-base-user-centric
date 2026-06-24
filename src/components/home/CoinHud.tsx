import { Link } from "react-router-dom";
import { Flame, Coins } from "lucide-react";
import { useStreak } from "@/hooks/useEconomy";
import { useFichas } from "@/hooks/useFichas";
import { cn } from "@/lib/utils";

interface CoinHudProps {
  /** Valor de rating/nivel (capa habilidad → volt). */
  rating?: number | string;
  className?: string;
}

// HUD de doble moneda (diseño `.hud` + `.coin`): logo AcePlay + RATING (volt, no
// se canjea) + PUNTOS/Fichas (oro, gastable → Tienda) + RACHA (naranja/llama).
// Firewall visual: rating(volt) y fichas(oro) son capas distintas, nunca se mezclan.
export function CoinHud({ rating, className }: CoinHudProps) {
  const { data: fichas } = useFichas();
  const { data: streak } = useStreak();
  const weeks = streak?.current_weeks ?? 0;
  return (
    <div className={cn("glass-bar flex items-center gap-2 rounded-[22px] px-3.5 py-2.5", className)}>
      <span className="mr-auto flex items-center gap-2 font-display text-lg font-black tracking-tight text-foreground">
        <span className="grid h-6 w-6 place-items-center rounded-lg bg-gradient-to-br from-action to-[hsl(var(--action-deep))] text-[11px] text-action-foreground">
          ✦
        </span>
        Ace<span className="text-action">Play</span>
      </span>

      {/* RATING · skill (volt) — se oculta si no hay valor disponible */}
      {rating != null && rating !== "" && (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-skill/10 px-2.5 py-1 text-sm font-extrabold text-skill" aria-label="Tu rating">
          <span className="grid h-5 w-5 place-items-center rounded-full bg-gradient-to-br from-skill to-[hsl(var(--skill-deep))] text-[9px] text-[hsl(var(--skill-foreground))]">◈</span>
          <span className="tabular-nums">{rating}</span>
        </span>
      )}

      {/* PUNTOS · fichas (oro) → Tienda */}
      <Link to="/tienda" aria-label="Tus Fichas · ir a la Tienda" className="inline-flex items-center gap-1.5 rounded-full border border-border bg-fichas/10 px-2.5 py-1 text-sm font-extrabold text-fichas transition-smooth hover:bg-fichas/20">
        <Coins className="h-4 w-4" />
        <span className="tabular-nums">{fichas?.balance ?? 0}</span>
      </Link>

      {/* RACHA (naranja) */}
      <span className="inline-flex items-center gap-1 rounded-full border border-action/30 bg-action/10 px-2 py-1 text-sm font-extrabold text-action" aria-label={`Racha ${weeks} semanas`}>
        <Flame className="h-4 w-4" />
        <span className="tabular-nums">{weeks}</span>
      </span>
    </div>
  );
}
