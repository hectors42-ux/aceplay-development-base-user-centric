import { CalendarCheck } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { TierGem, type Tier } from "./TierGem";
import { useArenaMotion } from "./motion";

export interface LeagueChipProps {
  tier: Tier;
  division?: string;   // p.ej. "Plata II"
  rank?: number;       // posición en la división esta semana
  className?: string;
}

// Liga = CONSTANCIA (capa enganche). Superficie neutra + gema de rango + icono de
// semana. NUNCA usa el lenguaje de habilidad (nivel/categoría): subir de liga es
// constancia, no mejora la categoría. Esa separación es la regla de claridad §07.
export function LeagueChip({ tier, division, rank, className }: LeagueChipProps) {
  const { reveal } = useArenaMotion();
  const label = division ?? tier[0].toUpperCase() + tier.slice(1);
  return (
    <motion.div
      {...reveal}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-2.5 py-1",
        className,
      )}
    >
      <TierGem tier={tier} size="sm" />
      <div className="leading-tight">
        <p className="flex items-center gap-1 text-[11px] font-semibold text-foreground">
          <CalendarCheck className="h-3 w-3 text-muted-foreground" aria-hidden /> Liga {label}
        </p>
        {typeof rank === "number" && (
          <p className="text-[10px] text-muted-foreground">#{rank} esta semana</p>
        )}
      </div>
    </motion.div>
  );
}
