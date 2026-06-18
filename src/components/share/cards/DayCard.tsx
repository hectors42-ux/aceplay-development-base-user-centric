import { ShareCardFrame, type ShareFormat } from "../ShareCardFrame";
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

export function DayCard({ format, cobrand, stats, tournamentName, slug }: Props) {
  const handle = handleFor(stats.user?.first_name, stats.user?.last_name);
  const name = fullName(stats.user?.first_name, stats.user?.last_name);
  const inviteUrl = buildInviteLink(slug);
  const matches = stats.wins + stats.losses;

  return (
    <ShareCardFrame format={format} cobrand={cobrand} handle={handle} inviteUrl={inviteUrl}>
      <div className="absolute right-7 top-7">
        <QrInline url={`https://${inviteUrl}`} size={60} />
      </div>

      <div className="mt-6 flex flex-1 flex-col">
        <p
          className="text-[10px] uppercase tracking-[0.32em] text-white/75"
          style={{ fontFamily: "'DM Mono', monospace" }}
        >
          Cierre del día · {tournamentName}
        </p>

        <h1 className="mt-3 font-display text-[44px] font-semibold leading-[1.02]">
          Cerré <em className="italic text-[hsl(var(--gold))]">Top {stats.rank ?? "—"}</em>
        </h1>

        <p className="mt-2 font-display text-2xl">{name}</p>

        <div className="mt-7 grid grid-cols-3 gap-3">
          <Stat value={String(stats.total_players ?? 0)} label="Jugadores" />
          <Stat value={String(matches)} label="Partidos" />
          <Stat value={String(stats.points ?? 0)} label="Puntos" />
        </div>

        <p className="mt-7 text-base text-white/85">
          {stats.wins} ganados · {stats.losses} perdidos. Cada partido suma al ranking del club.
        </p>

        <p className="mt-auto font-display text-2xl italic text-[hsl(var(--gold))]">
          Descarga AcePlay →
        </p>
      </div>
    </ShareCardFrame>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="font-display text-2xl font-semibold leading-none">{value}</p>
      <p
        className="mt-1 text-[9px] uppercase tracking-[0.24em] opacity-75"
        style={{ fontFamily: "'DM Mono', monospace" }}
      >
        {label}
      </p>
    </div>
  );
}