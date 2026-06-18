import { ShareCardFrame, type ShareFormat } from "../ShareCardFrame";
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

export function ProfileCard({ format, cobrand, stats, tournamentName, slug }: Props) {
  const handle = handleFor(stats.user?.first_name, stats.user?.last_name);
  const name = fullName(stats.user?.first_name, stats.user?.last_name);
  const inviteUrl = buildInviteLink(slug);
  const initials =
    `${stats.user?.first_name?.[0] ?? ""}${stats.user?.last_name?.[0] ?? ""}`
      .toUpperCase() || "AC";

  return (
    <ShareCardFrame format={format} cobrand={cobrand} handle={handle} inviteUrl={inviteUrl}>
      <div className="mt-6 flex flex-1 flex-col items-center text-center">
        <div
          className="flex h-28 w-28 items-center justify-center rounded-full bg-white/15 text-white ring-2 ring-white/40"
          style={{
            backgroundImage: stats.user?.avatar_url
              ? `url(${stats.user.avatar_url})`
              : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          {!stats.user?.avatar_url && (
            <span className="font-display text-3xl font-semibold">{initials}</span>
          )}
        </div>

        <p
          className="mt-4 text-[10px] uppercase tracking-[0.32em] text-white/70"
          style={{ fontFamily: "'DM Mono', monospace" }}
        >
          #{stats.rank ?? "—"} de {stats.total_players ?? 0} · {tournamentName}
        </p>

        <h1 className="mt-2 font-display text-[34px] font-semibold leading-[1.04]">
          {name}
        </h1>

        <div className="mt-6 grid w-full grid-cols-3 gap-2">
          <Stat value={String(stats.points ?? 0)} label="Puntos" />
          <Stat value={`${stats.wins}-${stats.losses}`} label="W-L" />
          <Stat value={String(stats.consecutive_wins ?? 0)} label="Racha" />
        </div>

        <p className="mt-auto text-base italic text-white/85">
          Sigue jugando en el club. Activa tu membresía en AcePlay.
        </p>
      </div>
    </ShareCardFrame>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl bg-white/10 px-2 py-3">
      <p className="font-display text-xl font-semibold leading-none">{value}</p>
      <p
        className="mt-1 text-[9px] uppercase tracking-[0.24em] opacity-75"
        style={{ fontFamily: "'DM Mono', monospace" }}
      >
        {label}
      </p>
    </div>
  );
}