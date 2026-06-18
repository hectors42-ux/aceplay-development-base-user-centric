import { forwardRef } from "react";
import type { ShareFormat } from "./ShareCardFrame";
import { ChampionCard } from "./cards/ChampionCard";
import { MomentCard } from "./cards/MomentCard";
import { StandingsCard } from "./cards/StandingsCard";
import { DayCard } from "./cards/DayCard";
import { ProfileCard } from "./cards/ProfileCard";
import type { TournamentCobrand } from "@/hooks/useTournamentCobrand";
import type { ShareStats, ShareStandings } from "@/hooks/useShareCardData";
import type { ShareMoment } from "@/hooks/useActiveMoment";

export type ShareKind = "champion" | "moment" | "standings" | "day" | "profile";

interface Props {
  kind: ShareKind;
  format: ShareFormat;
  cobrand: TournamentCobrand | null;
  stats: ShareStats;
  moment?: ShareMoment | null;
  standings?: ShareStandings | null;
  tournamentName: string;
  slug: string;
  highlightUserId?: string | null;
}

/**
 * Wrapper que selecciona la variante. Forward ref para que html-to-image
 * capture el snapshot del DOM real (sin canvas a mano).
 */
export const ShareCard = forwardRef<HTMLDivElement, Props>(function ShareCard(props, ref) {
  const { kind, format, cobrand, stats, tournamentName, slug } = props;
  return (
    <div ref={ref} className="inline-block">
      {kind === "champion" && (
        <ChampionCard
          format={format}
          cobrand={cobrand}
          stats={stats}
          tournamentName={tournamentName}
          slug={slug}
        />
      )}
      {kind === "moment" && props.moment && (
        <MomentCard
          format={format}
          cobrand={cobrand}
          stats={stats}
          moment={props.moment}
          tournamentName={tournamentName}
          slug={slug}
        />
      )}
      {kind === "standings" && props.standings && (
        <StandingsCard
          format={format}
          cobrand={cobrand}
          standings={props.standings}
          highlightUserId={props.highlightUserId}
          selfFirstName={stats.user?.first_name}
          selfLastName={stats.user?.last_name}
          tournamentName={tournamentName}
          slug={slug}
        />
      )}
      {kind === "day" && (
        <DayCard
          format={format}
          cobrand={cobrand}
          stats={stats}
          tournamentName={tournamentName}
          slug={slug}
        />
      )}
      {kind === "profile" && (
        <ProfileCard
          format={format}
          cobrand={cobrand}
          stats={stats}
          tournamentName={tournamentName}
          slug={slug}
        />
      )}
    </div>
  );
});