import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useArenaMotion } from "./motion";

export interface ArenaHeroProps {
  nivel: number;       // 0-7
  categoria: string;   // p.ej. "Tercera" / "A"
  sport?: string;      // "Pádel" / "Tenis"
  className?: string;
  /** Slot opcional ARRIBA (p.ej. avatar Rally). Solo el Inicio lo usa. */
  avatar?: ReactNode;
  /** Slot opcional ABAJO, dentro del hero (p.ej. el camino de ascenso). */
  footer?: ReactNode;
}

// Arena Hero — la insignia de CATEGORÍA como trofeo (capa HABILIDAD), con el
// ANILLO VOLT (conic-gradient enmascarado) y la categoría en volt con glow,
// según docs/design/tokens/aceplay-arena.css (`.arena` + `.ring` + `.cat`).
export function ArenaHero({ nivel, categoria, sport, className, avatar, footer }: ArenaHeroProps) {
  const { reveal } = useArenaMotion();
  return (
    <motion.div
      {...reveal}
      style={{ background: "var(--arena-grad, radial-gradient(120% 120% at 50% 0%, hsl(var(--card)) 0%, hsl(var(--background)) 70%))" }}
      className={cn(
        "arena-ring relative overflow-hidden rounded-[28px] border border-border p-6 text-center shadow-card",
        className,
      )}
    >
      {avatar && <div className="mb-3 flex justify-center">{avatar}</div>}
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        Categoría actual{sport ? ` · ${sport}` : ""}
      </p>
      <p
        className="mt-2 font-display text-[44px] font-black uppercase leading-none tracking-tight text-skill"
        style={{ textShadow: "0 0 26px hsl(var(--skill) / 0.45)" }}
      >
        {categoria}
      </p>
      <p className="mt-2 text-[13px] font-semibold text-muted-foreground">
        Nivel <span className="tabular-nums text-foreground">{Number(nivel).toFixed(1)}</span> / 7.0
      </p>
      {footer && <div className="mt-4 border-t border-border/60 pt-4 text-left">{footer}</div>}
    </motion.div>
  );
}
