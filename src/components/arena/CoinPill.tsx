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
        // Rating = ESCUDO con gradiente volt (§5.1). Firewall visual: volt/escudo
        // para habilidad; oro/moneda para Fichas. Nunca se mezclan.
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden>
          <defs>
            <linearGradient id="ace-volt-shield" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--skill))" />
              <stop offset="100%" stopColor="hsl(var(--skill-deep))" />
            </linearGradient>
          </defs>
          <path d="M12 2 3.5 5.2v6.1c0 5.05 3.6 8.4 8.5 10.2 4.9-1.8 8.5-5.15 8.5-10.2V5.2L12 2Z" fill="url(#ace-volt-shield)" />
        </svg>
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
