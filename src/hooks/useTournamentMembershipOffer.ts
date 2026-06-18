// TODO: cablear fase 2
export interface MembershipOffer {
  tournament_id: string;
  plan_id: string;
  plan_name: string;
  price_clp: number;
  benefits: string[];
}

export function useTournamentMembershipOffer(_tournamentId: string | null | undefined) {
  // TODO: cablear fase 2
  return { offer: null as MembershipOffer | null, loading: false };
}
