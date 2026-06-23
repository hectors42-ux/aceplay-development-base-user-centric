import { Flame } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useArenaMotion } from "./motion";

export interface StreakChipProps {
  weeks: number;
  className?: string;
}

// Racha = constancia (capa enganche). Usa el rol ACTION (naranja) por G —
// "racha" comparte el lenguaje de acción/energía. Reduce-motion deja la llama fija.
export function StreakChip({ weeks, className }: StreakChipProps) {
  const { reveal, reduced } = useArenaMotion();
  return (
    <motion.div
      {...reveal}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-action/12 px-2.5 py-1 text-action",
        className,
      )}
    >
      <motion.span
        aria-hidden
        animate={reduced ? undefined : { scale: [1, 1.14, 1] }}
        transition={reduced ? undefined : { duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
      >
        <Flame className="h-3.5 w-3.5" />
      </motion.span>
      <span className="text-xs font-bold tabular-nums">{weeks}</span>
      <span className="text-[10px] font-medium uppercase tracking-wide opacity-80">sem</span>
    </motion.div>
  );
}
