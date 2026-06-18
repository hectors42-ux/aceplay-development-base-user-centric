import { motion, AnimatePresence } from "framer-motion";
import { useLiveStandings, type LiveTournament } from "@/hooks/useLiveOverlay";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { OverlayClock } from "./OverlayClock";
import { LiveBadge } from "./LiveBadge";

const MEDAL_COLORS = ["from-yellow-300 to-amber-500", "from-slate-200 to-slate-400", "from-orange-300 to-orange-500"];

export function StandingsOverlay({ slug, tournament }: { slug: string; tournament: LiveTournament }) {
  const { rows } = useLiveStandings(slug, tournament.id);
  const reduced = usePrefersReducedMotion();

  return (
    <div className="flex h-full w-full flex-col p-16 text-white">
      <header className="flex items-start justify-between">
        <div className="flex items-center gap-6">
          {tournament.cobrand?.logo_url && (
            <img src={tournament.cobrand.logo_url} alt="" className="h-24 w-auto object-contain" />
          )}
          <div>
            <p className="font-mono text-sm uppercase tracking-[0.4em] opacity-80">
              AcePlay{tournament.cobrand?.display_name ? ` × ${tournament.cobrand.display_name}` : ""}
            </p>
            <h1 className="font-display text-6xl font-semibold leading-tight">{tournament.name}</h1>
            {tournament.current_round && (
              <p className="mt-2 font-mono text-lg uppercase tracking-[0.3em] opacity-80">
                Ronda {tournament.current_round}
                {tournament.total_rounds ? ` / ${tournament.total_rounds}` : ""}
              </p>
            )}
          </div>
        </div>
        <OverlayClock className="font-mono text-5xl font-bold tabular-nums" />
      </header>

      <p className="mt-8 font-mono text-xl uppercase tracking-[0.4em] opacity-70">Tabla general</p>

      <div className="mt-6 flex-1 space-y-3">
        <AnimatePresence initial={false}>
          {rows.slice(0, 8).map((r) => (
            <motion.div
              key={`${r.display_name}-${r.initials}`}
              layout={!reduced}
              transition={{ type: "spring", stiffness: 180, damping: 22, duration: reduced ? 0 : 0.45 }}
              className="flex items-center gap-8 rounded-2xl bg-white/10 px-8 py-5 backdrop-blur"
            >
              <span className="w-16 font-display text-5xl font-bold tabular-nums">{r.rank}</span>
              <span
                className={`grid h-16 w-16 place-items-center rounded-full font-mono text-xl font-bold ${
                  r.rank <= 3
                    ? `bg-gradient-to-br ${MEDAL_COLORS[r.rank - 1]} text-ink`
                    : "bg-white/20"
                }`}
              >
                {r.initials}
              </span>
              <span className="flex-1 truncate font-display text-4xl font-medium">{r.display_name}</span>
              <span className="font-mono text-4xl font-bold tabular-nums">+{r.points}</span>
            </motion.div>
          ))}
        </AnimatePresence>
        {rows.length === 0 && (
          <p className="text-3xl italic opacity-60">Sin datos de tabla aún.</p>
        )}
      </div>

      <footer className="mt-8 flex items-end justify-between">
        <p className="font-mono text-xl opacity-80">juega.aceplay.app/i/{tournament.slug}</p>
        <LiveBadge />
      </footer>
    </div>
  );
}