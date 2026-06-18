import { useEffect, useState } from "react";
import { useLiveStandings, type LiveTournament } from "@/hooks/useLiveOverlay";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { OverlayClock } from "./OverlayClock";

export function LowerThirdOverlay({ slug, tournament }: { slug: string; tournament: LiveTournament }) {
  const { rows } = useLiveStandings(slug, tournament.id);
  const reduced = usePrefersReducedMotion();
  const [idx, setIdx] = useState(0);

  const tickers: string[] = [];
  if (rows[0]) tickers.push(`${rows[0].display_name.toUpperCase()} · líder con +${rows[0].points}`);
  if (tournament.current_round) tickers.push(`Ronda ${tournament.current_round}${tournament.total_rounds ? ` / ${tournament.total_rounds}` : ""}`);
  tickers.push(`AcePlay${tournament.cobrand?.display_name ? ` × ${tournament.cobrand.display_name}` : ""} · ${tournament.name}`);

  useEffect(() => {
    if (reduced || tickers.length <= 1) return;
    const i = setInterval(() => setIdx((v) => (v + 1) % tickers.length), 8000);
    return () => clearInterval(i);
  }, [reduced, tickers.length]);

  const current = tickers[idx] ?? tickers[0] ?? tournament.name;

  return (
    <div
      className="flex h-full w-full items-center gap-8 px-12"
      style={{ background: tournament.cobrand?.gradient_css ?? "linear-gradient(90deg,#b6502b,#2b1b12)" }}
    >
      {tournament.cobrand?.logo_url ? (
        <img src={tournament.cobrand.logo_url} alt="" className="h-32 w-auto object-contain" />
      ) : (
        <div className="font-display text-4xl font-bold text-white">AcePlay</div>
      )}
      <div className="flex-1 text-center">
        <p
          key={current}
          className={`font-display text-7xl font-semibold text-white ${reduced ? "" : "animate-in fade-in duration-700"}`}
        >
          {current}
        </p>
      </div>
      <OverlayClock className="font-mono text-6xl font-bold tabular-nums text-white" />
    </div>
  );
}