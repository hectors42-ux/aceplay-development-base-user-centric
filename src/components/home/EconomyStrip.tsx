import { useNavigate } from "react-router-dom";
import { Target, CheckCircle2 } from "lucide-react";
import { useXP, useLeague, useStreak, useMissions, tierName } from "@/hooks/useEconomy";
import { useFichas } from "@/hooks/useFichas";
import { LeagueChip, StreakChip, XPMeter, CoinPill, type Tier } from "@/components/arena";
import { cn } from "@/lib/utils";

/**
 * Capas ENGANCHE + PREMIO del home (Épica J-bis): compuesto con primitivas Arena
 * (LeagueChip + StreakChip + XPMeter + CoinPill) reusando los mismos hooks de
 * lectura. El hero de HABILIDAD (ArenaHero) vive aparte en Index. Conserva las
 * misiones. Solo lectura; no toca el motor competitivo.
 */

// Tier de liga (número: 1=Bronce … 5=Diamante) → gema TierGem (Madera→Platino).
const LEAGUE_TIER_GEM: Tier[] = ["madera", "bronce", "plata", "oro", "platino", "platino"];
const gemForTier = (t?: number | null): Tier => LEAGUE_TIER_GEM[Math.min(Math.max(t ?? 0, 0), 5)];

export const EconomyStrip = () => {
  const { data: xp } = useXP();
  const { data: league = [] } = useLeague();
  const { data: streak } = useStreak();
  const { data: missions = [] } = useMissions();
  const { data: fichas } = useFichas();
  const navigate = useNavigate();

  const me = league.find((m) => m.is_me);
  const tier = me?.tier ?? null;
  const rank = me?.rank ?? null;
  const xpWeek = xp?.xp_week ?? 0;
  // No hay "meta" de XP en los datos → referencia relativa al líder de la liga.
  const xpMax = Math.max(...league.map((m) => m.xp_week), xpWeek, 1);

  return (
    <section className="px-5" aria-label="Tu progreso de la semana">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
        {/* CAPA ENGANCHE — constancia */}
        <div className="rounded-2xl border border-border bg-card p-3 shadow-card">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Constancia · enganche
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <LeagueChip tier={gemForTier(tier)} division={tier != null ? tierName(tier) : undefined} rank={rank ?? undefined} />
            <StreakChip weeks={streak?.current_weeks ?? 0} />
          </div>
          <XPMeter value={xpWeek} max={xpMax} className="mt-3" />
        </div>

        {/* CAPA PREMIO — Fichas (moneda → Tienda) */}
        <div className="flex items-center justify-center rounded-2xl border border-border bg-card p-3 shadow-card">
          <div className="text-center">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Premio</p>
            <CoinPill kind="fichas" value={fichas?.balance ?? 0} onClick={() => navigate("/tienda")} />
          </div>
        </div>
      </div>

      {/* Misiones — sin primitiva Arena propia; tokens de rol (XP=skill, hecho=confirm). */}
      {missions.length > 0 && (
        <div className="mt-3 space-y-2 rounded-2xl border border-border bg-card p-4 shadow-card">
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
    </section>
  );
};

export default EconomyStrip;
