import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useArenaMotion } from "./motion";

export interface StepsProps {
  current: number;   // nivel actual (0-7)
  total?: number;    // pasos máx (default 7)
  className?: string;
}

// Camino de ascenso (7 pasos = niveles 0-7). Capa HABILIDAD (skill/volt). Pasos
// logrados en volt, el actual resaltado, futuros en muted. Reduce-motion: aparecen
// sin escalonado.
export function Steps({ current, total = 7, className }: StepsProps) {
  const { reduced } = useArenaMotion();
  const steps = Array.from({ length: total + 1 }, (_, i) => i); // 0..total
  return (
    <ol className={cn("flex items-center gap-1", className)} aria-label="Camino de ascenso de nivel">
      {steps.map((s) => {
        const done = s < current;
        const here = s === current;
        return (
          <li key={s} className="flex flex-1 items-center gap-1">
            <motion.span
              initial={reduced ? false : { scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: reduced ? 0 : s * 0.04, type: "spring", stiffness: 320, damping: 20 }}
              aria-current={here ? "step" : undefined}
              className={cn(
                "grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-bold tabular-nums",
                here
                  ? "bg-skill text-skill-foreground ring-2 ring-skill/40"
                  : done
                    ? "bg-skill/25 text-skill"
                    : "bg-muted text-muted-foreground",
              )}
            >
              {s}
            </motion.span>
            {s < total && (
              <span className={cn("h-0.5 flex-1 rounded-full", s < current ? "bg-skill/50" : "bg-muted")} />
            )}
          </li>
        );
      })}
    </ol>
  );
}
