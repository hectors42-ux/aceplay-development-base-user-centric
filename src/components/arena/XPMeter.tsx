import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useArenaMotion } from "./motion";

export interface XPMeterProps {
  value: number;
  max: number;
  label?: string;
  className?: string;
}

// XP = habilidad/skill (rol skill/volt) por G. La barra mide progreso de XP; el
// contexto de Liga (enganche) lo da el contenedor, pero el COLOR de la XP es volt.
export function XPMeter({ value, max, label = "XP semana", className }: XPMeterProps) {
  const { reduced } = useArenaMotion();
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  return (
    <div className={cn("w-full", className)}>
      <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wide text-muted-foreground">
        <span>{label}</span>
        <span className="tabular-nums text-skill">{value}/{max}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={value} aria-valuemax={max} aria-valuemin={0}>
        <motion.div
          className="h-full rounded-full bg-skill"
          initial={reduced ? false : { width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={reduced ? { duration: 0 } : { duration: 0.7, ease: [0.32, 0.72, 0, 1] }}
        />
      </div>
    </div>
  );
}
