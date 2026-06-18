import type { LiveTournament } from "@/hooks/useLiveOverlay";

export function BracketOverlay({ tournament }: { tournament: LiveTournament }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 p-16 text-white">
      <p className="font-mono text-xl uppercase tracking-[0.4em] opacity-60">
        AcePlay{tournament.cobrand?.display_name ? ` × ${tournament.cobrand.display_name}` : ""}
      </p>
      <h1 className="font-display text-7xl font-semibold">{tournament.name}</h1>
      <p className="font-display text-3xl italic opacity-80">Bracket en vivo · próximamente</p>
    </div>
  );
}