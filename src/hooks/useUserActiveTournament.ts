// TODO: cablear fase 2
export type ActiveTournamentInfo = {
  tournament: any;
  category: { id: string; name: string };
  registrationId: string;
  nextMatch: {
    id: string;
    scheduled_at: string;
    court_name: string | null;
    rival_name: string;
  } | null;
  reportableMatch: {
    id: string;
    scheduled_at: string;
  } | null;
  lastResult: {
    id: string;
    won: boolean;
    rival_name: string;
    played_at: string | null;
  } | null;
  bracketPublished: boolean;
};

export function useUserActiveTournament() {
  // TODO: cablear fase 2
  return { data: null as ActiveTournamentInfo | null, loading: false };
}
