import type { ReactNode } from "react";
import { ShareCardFrame, type ShareFormat } from "../ShareCardFrame";
import { Medal } from "../Medal";
import { QrInline } from "../QrInline";
import type { TournamentCobrand } from "@/hooks/useTournamentCobrand";
import type { ShareStats } from "@/hooks/useShareCardData";
import { fullName, handleFor, buildInviteLink } from "@/lib/share-card-copy";

interface Props {
  format: ShareFormat;
  cobrand: TournamentCobrand | null;
  stats: ShareStats;
  tournamentName: string;
  slug: string;
}

export function ChampionCard({ format, cobrand, stats, tournamentName, slug }: Props) {
  const first = stats.user?.first_name?.trim() ?? "";
  const last = stats.user?.last_name?.trim() ?? "";
  const fallback = fullName(first, last);
  const handle = handleFor(stats.user?.first_name, stats.user?.last_name);
  const inviteUrl = buildInviteLink(slug);
  const total = stats.total_players ?? 0;
  const matches = (stats.wins ?? 0) + (stats.losses ?? 0);

  return (
    <ShareCardFrame format={format} cobrand={cobrand} handle={handle} inviteUrl={inviteUrl}>
      <div className="absolute right-7 top-7">
        <QrInline url={`https://${inviteUrl}`} size={60} />
      </div>

      <div className="mt-6 flex flex-1 flex-col">
        <p
          className="text-[10px] uppercase tracking-[0.32em] text-white/70"
          style={{ fontFamily: "'DM Mono', monospace" }}
        >
          Campeón · {tournamentName}
        </p>

        <h1
          className="mt-auto font-display font-medium italic leading-[0.92] text-white"
          style={{ fontSize: 64 }}
        >
          {first || fallback}
          {last && (
            <>
              <br />
              {last}
            </>
          )}
        </h1>

        <div className="mt-6 flex items-center gap-4">
          <Medal place={1} size={56} />
          <div>
            <p
              className="text-[10px] uppercase tracking-[0.28em] text-white/70"
              style={{ fontFamily: "'DM Mono', monospace" }}
            >
              Lugar
            </p>
            <p className="font-display text-sm text-white">
              Primer{" "}
              {total > 0 ? `entre ${total} jugadores` : "lugar"}
            </p>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-3 gap-4 border-t border-white/20 pt-4">
          <Stat value={`+${stats.points ?? 0}`} label="Puntos" />
          <Stat value={`${stats.wins}-${stats.losses}`} label="Win-Loss" />
          <Stat value={String(matches)} label="Partidos" />
        </div>
      </div>
    </ShareCardFrame>
  );
}

function Stat({
  value,
  label,
  highlight,
}: {
  value: ReactNode;
  label: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <p
        className={`font-display text-3xl font-semibold leading-none ${
          highlight ? "text-[hsl(var(--gold))]" : ""
        }`}
      >
        {value}
      </p>
      <p
        className="mt-1 text-[10px] uppercase tracking-[0.28em] opacity-75"
        style={{ fontFamily: "'DM Mono', monospace" }}
      >
        {label}
      </p>
    </div>
  );
}