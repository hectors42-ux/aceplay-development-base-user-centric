import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useArenaMotion } from "./motion";

export type Tier = "madera" | "bronce" | "plata" | "oro" | "platino";

export const TIER_ORDER: Tier[] = ["madera", "bronce", "plata", "oro", "platino"];
const TIER_LABEL: Record<Tier, string> = {
  madera: "Madera", bronce: "Bronce", plata: "Plata", oro: "Oro", platino: "Platino",
};

// Metales de RANGO (capa enganche/liga). Deliberadamente BAJA saturación para no
// confundirse con los roles vivos (skill/fichas/etc.) — un medallero, no un dato.
// Overridable por CSS var `--tier-<id>` para que la Épica K re-tinte por tema.
const TIER_HSL: Record<Tier, string> = {
  madera: "28 30% 40%",
  bronce: "24 48% 48%",
  plata: "220 10% 68%",
  oro: "40 52% 54%",
  platino: "205 22% 82%",
};

const SIZE = { sm: 20, md: 32, lg: 48 } as const;

export interface TierGemProps {
  tier: Tier;
  size?: keyof typeof SIZE;
  className?: string;
  title?: string;
}

/** Gema facetada de rango de liga (Madera→Platino). Decorativa, token-driven. */
export function TierGem({ tier, size = "md", className, title }: TierGemProps) {
  const { reduced } = useArenaMotion();
  const px = SIZE[size];
  const tone = `hsl(var(--tier-${tier}, ${TIER_HSL[tier]}))`;
  const gid = `gem-${tier}`;
  return (
    <motion.svg
      width={px} height={px} viewBox="0 0 32 32" role="img"
      aria-label={title ?? `Liga ${TIER_LABEL[tier]}`}
      className={cn("shrink-0", className)}
      initial={reduced ? false : { rotate: -6, scale: 0.9, opacity: 0 }}
      animate={{ rotate: 0, scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 320, damping: 20 }}
      style={{ color: tone }}
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(0 0% 100% / 0.55)" />
          <stop offset="40%" stopColor="currentColor" />
          <stop offset="100%" stopColor="hsl(0 0% 0% / 0.35)" />
        </linearGradient>
      </defs>
      <path d="M16 2 L27 11 L16 30 L5 11 Z" fill={`url(#${gid})`} stroke="hsl(0 0% 100% / 0.25)" strokeWidth="0.75" />
      <path d="M16 2 L27 11 L16 16 Z" fill="hsl(0 0% 100% / 0.18)" />
      <path d="M5 11 L16 16 L16 2 Z" fill="hsl(0 0% 0% / 0.12)" />
    </motion.svg>
  );
}
