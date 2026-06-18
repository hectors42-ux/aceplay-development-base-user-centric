import { useLiveNowPlaying, type LiveTournament } from "@/hooks/useLiveOverlay";
import { LiveBadge } from "./LiveBadge";
import { OverlayClock } from "./OverlayClock";

function setsToScore(score: unknown): { a: number; b: number } {
  if (!Array.isArray(score)) return { a: 0, b: 0 };
  let a = 0, b = 0;
  for (const s of score as Array<{ a?: number; b?: number }>) {
    if ((s.a ?? 0) > (s.b ?? 0)) a++;
    else if ((s.b ?? 0) > (s.a ?? 0)) b++;
  }
  return { a, b };
}

export function NowPlayingOverlay({ slug, tournament }: { slug: string; tournament: LiveTournament }) {
  const { match } = useLiveNowPlaying(slug, tournament.id);

  if (!match) {
    return (
      <div className="flex h-full w-full items-center justify-center p-16 text-white">
        <p className="font-display text-5xl italic opacity-70">Sin partido en juego.</p>
      </div>
    );
  }

  const sc = setsToScore(match.score);

  return (
    <div className="flex h-full w-full flex-col p-16 text-white">
      <header className="flex items-start justify-between">
        <div>
          <p className="font-mono text-2xl uppercase tracking-[0.4em] opacity-80">
            {match.court} · Ronda {match.round}
          </p>
          {tournament.cobrand?.display_name && (
            <p className="mt-2 font-mono text-base uppercase tracking-[0.4em] opacity-60">
              AcePlay × {tournament.cobrand.display_name}
            </p>
          )}
        </div>
        <OverlayClock className="font-mono text-5xl font-bold tabular-nums" />
      </header>

      <div className="flex flex-1 flex-col justify-center gap-12">
        <div className="flex items-center gap-12">
          <p className="flex-1 font-display text-7xl font-semibold leading-tight">
            {match.side_a_names}
          </p>
          <p className="font-mono text-[220px] font-bold tabular-nums leading-none">{sc.a}</p>
        </div>
        <div className="h-px w-full bg-white/30" />
        <div className="flex items-center gap-12">
          <p className="flex-1 font-display text-7xl font-semibold leading-tight">
            {match.side_b_names}
          </p>
          <p className="font-mono text-[220px] font-bold tabular-nums leading-none">{sc.b}</p>
        </div>
      </div>

      <footer className="mt-8 flex items-end justify-between">
        <LiveBadge />
        <p className="font-mono text-xl opacity-70">juega.aceplay.app/i/{tournament.slug}</p>
      </footer>
    </div>
  );
}