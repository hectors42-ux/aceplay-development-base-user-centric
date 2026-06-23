import { Trophy } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useArenaMotion } from "./motion";

export interface ArenaHeroProps {
  nivel: number;       // 0-7
  categoria: string;   // p.ej. "Cuarta"
  sport?: string;      // "Pádel" / "Tenis"
  className?: string;
}

// Nivel/categoría como TROFEO (capa HABILIDAD). Usa skill/volt. Lenguaje de
// habilidad: la categoría se deriva del rating/nivel — nunca de la liga.
export function ArenaHero({ nivel, categoria, sport, className }: ArenaHeroProps) {
  const { reveal, reduced } = useArenaMotion();
  return (
    <motion.div
      {...reveal}
      className={cn("relative overflow-hidden rounded-3xl border border-border bg-card p-5 shadow-card", className)}
    >
      <div aria-hidden className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-skill/10 blur-2xl" />
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Tu nivel{sport ? ` · ${sport}` : ""}
      </p>
      <div className="mt-2 flex items-end gap-3">
        <motion.div
          initial={reduced ? false : { scale: 0.8, rotate: -8, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 280, damping: 18 }}
          className="grid h-16 w-16 place-items-center rounded-2xl bg-skill/15 text-skill ring-1 ring-skill/30"
        >
          <Trophy className="h-7 w-7" strokeWidth={2.2} />
        </motion.div>
        <p className="font-display text-5xl font-bold leading-none tabular-nums text-foreground">{nivel}</p>
        <div className="ml-auto text-right">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Categoría</p>
          <p className="font-display text-xl font-semibold text-foreground">{categoria}</p>
        </div>
      </div>
    </motion.div>
  );
}
