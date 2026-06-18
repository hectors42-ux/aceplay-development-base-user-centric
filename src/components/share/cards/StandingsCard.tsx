import { ShareCardFrame, type ShareFormat } from "../ShareCardFrame";
import { Medal } from "../Medal";
import type { TournamentCobrand } from "@/hooks/useTournamentCobrand";
import type { ShareStandings } from "@/hooks/useShareCardData";
import { fullName, handleFor, buildInviteLink } from "@/lib/share-card-copy";

interface Props {
  format: ShareFormat;
  cobrand: TournamentCobrand | null;
  standings: ShareStandings;
  highlightUserId?: string | null;
  selfFirstName?: string | null;
  selfLastName?: string | null;
  tournamentName: string;
  slug: string;
}

export function StandingsCard({
  format,
  cobrand,
  standings,
  highlightUserId,
  selfFirstName,
  selfLastName,
  tournamentName,
  slug,
}: Props) {
  const handle = handleFor(selfFirstName, selfLastName);
  const inviteUrl = buildInviteLink(slug);
  const rows = standings.rows ?? [];
  const top3 = rows.slice(0, 3);
  const rest = rows.slice(3, 10);

  return (
    <ShareCardFrame format={format} cobrand={cobrand} handle={handle} inviteUrl={inviteUrl}>
      <div className="mt-5 flex flex-1 flex-col">
        <h1 className="font-display text-[34px] font-semibold leading-[1.02]">
          Tabla <em className="italic text-[hsl(var(--gold))]">en vivo</em>
        </h1>
        <p
          className="mt-1 text-[10px] uppercase tracking-[0.28em] text-white/75"
          style={{ fontFamily: "'DM Mono', monospace" }}
        >
          {tournamentName}
        </p>

        <div className="mt-5 flex items-end justify-between gap-2">
          {top3.length === 0 && (
            <p className="text-sm text-white/70">Aún no hay tabla.</p>
          )}
          {top3.map((row) => (
            <PodiumCol
              key={row.user_id}
              place={row.position as 1 | 2 | 3}
              name={fullName(row.first_name, row.last_name)}
              points={row.points}
            />
          ))}
        </div>

        {rest.length > 0 && (
          <div className="mt-5 space-y-1.5">
            {rest.map((row) => {
              const me = row.user_id === highlightUserId;
              return (
                <div
                  key={row.user_id}
                  className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-sm ${
                    me ? "bg-white/20 ring-1 ring-[hsl(var(--gold))]" : "bg-white/8"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="w-5 text-right text-xs opacity-80">{row.position}</span>
                    <span className="truncate">
                      {fullName(row.first_name, row.last_name)}
                    </span>
                  </span>
                  <span className="font-display text-base font-semibold">{row.points}</span>
                </div>
              );
            })}
          </div>
        )}

        <span
          className="mt-4 inline-flex w-fit items-center gap-1.5 rounded-full bg-[hsl(var(--gold))]/20 px-3 py-1 text-[10px] uppercase tracking-[0.28em] text-[hsl(var(--gold))]"
          style={{ fontFamily: "'DM Mono', monospace" }}
        >
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[hsl(var(--gold))]" />
          Actualiza en vivo
        </span>
      </div>
    </ShareCardFrame>
  );
}

function PodiumCol({
  place,
  name,
  points,
}: {
  place: 1 | 2 | 3;
  name: string;
  points: number;
}) {
  const height = place === 1 ? 130 : place === 2 ? 95 : 75;
  return (
    <div className="flex flex-1 flex-col items-center gap-1.5">
      <Medal place={place} size={place === 1 ? 52 : 40} />
      <p className="max-w-full truncate text-center text-xs font-medium">{name}</p>
      <div
        className="flex w-full items-start justify-center rounded-t-lg bg-white/10 pt-2"
        style={{ height }}
      >
        <span className="font-display text-xl font-semibold">{points}</span>
      </div>
    </div>
  );
}