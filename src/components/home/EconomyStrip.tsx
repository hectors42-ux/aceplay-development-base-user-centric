import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Zap, Flame, Trophy, Target, CheckCircle2, Coins, ChevronRight } from "lucide-react";
import { useXP, useLeague, useStreak, useMissions, tierName } from "@/hooks/useEconomy";
import { useFichas } from "@/hooks/useFichas";
import { cn } from "@/lib/utils";

/**
 * Capa de enganche en el home: XP de la semana + chip de Liga (tier y puesto) +
 * Racha, y un bloque compacto de misiones con su progreso. Mínimo funcional,
 * separado del motor competitivo (solo lee las RPCs de XP).
 */
export const EconomyStrip = () => {
  const { data: xp } = useXP();
  const { data: league = [] } = useLeague();
  const { data: streak } = useStreak();
  const { data: missions = [] } = useMissions();
  const { data: fichas } = useFichas();

  const me = league.find((m) => m.is_me);
  const tier = me?.tier ?? null;
  const rank = me?.rank ?? null;
  const weeks = streak?.current_weeks ?? 0;

  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="px-5"
      aria-label="Tu progreso de la semana"
    >
      <div className="rounded-3xl border border-border bg-card p-4 shadow-card">
        {/* Moneda de Fichas → acceso a la Tienda (HUD) */}
        <Link to="/tienda" aria-label="Ir a la Tienda de premios"
          className="mb-3 flex items-center justify-between rounded-2xl bg-fichas/12 px-3 py-2 transition-smooth hover:bg-fichas/20">
          <span className="flex items-center gap-2">
            <Coins className="h-4 w-4 text-fichas" strokeWidth={2.2} />
            <span className="font-display text-sm font-bold tabular-nums">{fichas?.balance ?? 0}</span>
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Fichas · Tienda</span>
          </span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>

        {/* Chips: XP · Liga · Racha */}
        <div className="grid grid-cols-3 gap-2">
          <div className="flex flex-col items-center justify-center rounded-2xl bg-skill/8 p-3 text-center">
            <Zap className="h-4 w-4 text-skill" strokeWidth={2.2} />
            <p className="mt-1 font-display text-lg font-bold tabular-nums leading-none">{xp?.xp_week ?? 0}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">XP semana</p>
          </div>
          <div className="flex flex-col items-center justify-center rounded-2xl bg-muted p-3 text-center">
            <Trophy className="h-4 w-4 text-muted-foreground" strokeWidth={2.2} />
            <p className="mt-1 font-display text-sm font-bold leading-none">{tier ? tierName(tier) : "—"}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {rank ? `Liga · #${rank}` : "Sin liga"}
            </p>
          </div>
          <div className="flex flex-col items-center justify-center rounded-2xl bg-muted p-3 text-center">
            <Flame className={cn("h-4 w-4", weeks > 0 ? "text-action" : "text-muted-foreground")} strokeWidth={2.2} />
            <p className="mt-1 font-display text-lg font-bold tabular-nums leading-none">{weeks}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{weeks === 1 ? "semana" : "semanas"}</p>
          </div>
        </div>

        {/* Misiones */}
        {missions.length > 0 && (
          <div className="mt-3 space-y-2">
            <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Target className="h-3 w-3" /> Misiones de la semana
            </p>
            {missions.map((m) => {
              const pct = Math.min(100, Math.round((m.progress / Math.max(1, m.target)) * 100));
              return (
                <div key={m.code} className="rounded-2xl border border-border/70 bg-background/40 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className={cn("truncate text-xs font-medium", m.completed && "text-muted-foreground line-through")}>
                      {m.title}
                    </p>
                    <span className="flex shrink-0 items-center gap-1 text-[11px] font-semibold text-skill">
                      {m.completed ? <CheckCircle2 className="h-3.5 w-3.5 text-confirm" /> : null}
                      +{m.reward_xp} XP
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className={cn("h-full rounded-full transition-all", m.completed ? "bg-confirm" : "bg-skill")} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[10px] tabular-nums text-muted-foreground">{Math.min(m.progress, m.target)}/{m.target}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </motion.section>
  );
};

export default EconomyStrip;
