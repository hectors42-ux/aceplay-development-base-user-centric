import { Flame } from "lucide-react";
import { ShareCardFrame, type ShareFormat } from "../ShareCardFrame";
import type { TournamentCobrand } from "@/hooks/useTournamentCobrand";
import type { ShareStats } from "@/hooks/useShareCardData";
import type { ShareMoment } from "@/hooks/useActiveMoment";
import {
  fullName,
  handleFor,
  buildInviteLink,
  streakTitle,
  climbTitle,
} from "@/lib/share-card-copy";

interface Props {
  format: ShareFormat;
  cobrand: TournamentCobrand | null;
  stats: ShareStats;
  moment: ShareMoment;
  tournamentName: string;
  slug: string;
}

export function MomentCard({ format, cobrand, stats, moment, tournamentName, slug }: Props) {
  const handle = handleFor(stats.user?.first_name, stats.user?.last_name);
  const name = fullName(stats.user?.first_name, stats.user?.last_name);
  const inviteUrl = buildInviteLink(slug);
  const seed = (stats.points ?? 0) + (moment.value ?? 0);
  const title = moment.kind === "climb" ? climbTitle(seed) : streakTitle(seed);
  const tag =
    moment.kind === "climb"
      ? `SUBIÓ ${moment.value} POSICIONES`
      : `RACHA DE ${moment.value} VICTORIAS`;
  const sub =
    moment.kind === "climb"
      ? `${name} escaló del #${(moment.rank ?? 0) + (moment.delta ?? 0)} al #${moment.rank ?? "?"}.`
      : `${name} suma ${moment.value} rondas seguidas ganando en ${tournamentName}.`;

  return (
    <ShareCardFrame format={format} cobrand={cobrand} handle={handle} inviteUrl={inviteUrl}>
      <div className="mt-6 flex flex-1 flex-col">
        <span
          className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[10px] uppercase tracking-[0.28em] text-white"
          style={{ fontFamily: "'DM Mono', monospace" }}
        >
          <Flame className="h-3 w-3 text-[hsl(var(--gold))]" />
          {tag}
        </span>

        <h1 className="mt-4 font-display text-[42px] font-semibold italic leading-[1.04] text-[hsl(var(--gold))]">
          {title}
        </h1>

        <p className="mt-3 text-base text-white/85">{sub}</p>

        <div className="mt-8 grid grid-cols-3 gap-3">
          <Stat value={`#${stats.rank ?? "—"}`} label="Posición" />
          <Stat value={String(stats.points ?? 0)} label="Puntos" />
          <Stat value={`${stats.wins}-${stats.losses}`} label="W-L" />
        </div>

        <p
          className="mt-auto text-[10px] uppercase tracking-[0.32em] text-white/65"
          style={{ fontFamily: "'DM Mono', monospace" }}
        >
          En vivo en AcePlay
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