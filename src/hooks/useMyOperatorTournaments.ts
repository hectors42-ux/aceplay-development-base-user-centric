// TODO: cablear fase 2
export type OperatorTournament = {
  id: string;
  slug: string;
  name: string;
  status: string;
};

export function useMyOperatorTournaments() {
  // TODO: cablear fase 2
  return { tournaments: [] as OperatorTournament[], loading: false };
}
