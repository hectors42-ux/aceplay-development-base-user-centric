import { Coins, TrendingUp, TrendingDown } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useArenaMotion } from "./motion";

export interface CoinPillProps {
  kind: "rating" | "fichas";
  value: number | string;
  /** delta opcional (puntos de rating / Fichas ganadas). */
  delta?: number;
  onClick?: () => void;
  className?: string;
}

// Dos roles, dos colores — NUNCA se mezclan:
//   rating = habilidad (skill/volt)   ·   fichas = premio (oro).
// La separación de color refuerza el firewall visual entre capas.
export function CoinPill({ kind, value, delta, onClick, className }: CoinPillProps) {
  const { pop } = useArenaMotion();
  const isFichas = kind === "fichas";
  const interactive = Boolean(onClick);
  const Comp = interactive ? motion.button : motion.div;
  return (
    <Comp
      {...(interactive ? { onClick, type: "button" as const, ...pop } : {})}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold tabular-nums",
        isFichas ? "bg-fichas/15 text-fichas" : "bg-skill/12 text-skill",
        interactive && "cursor-pointer",
        className,
      )}
    >
      {isFichas ? (
        <Coins className="h-3.5 w-3.5" aria-hidden />
      ) : (
        <span className="text-[10px] font-extrabold tracking-tight opacity-80">PTS</span>
      )}
      <span>{value}</span>
      {typeof delta === "number" && delta !== 0 && (
        <span className={cn("flex items-center gap-0.5 text-[10px]", delta > 0 ? "text-confirm" : "text-destructive")}>
          {delta > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {Math.abs(delta)}
        </span>
      )}
    </Comp>
  );
}
