// TODO: cablear fase 2
export interface TournamentPendingCounts {
  result_proposals: number;
  reschedule_requests: number;
  doubles_invitations: number;
  admin_pending_registrations: number;
  total: number;
}

const EMPTY: TournamentPendingCounts = {
  result_proposals: 0,
  reschedule_requests: 0,
  doubles_invitations: 0,
  admin_pending_registrations: 0,
  total: 0,
};

export function useTournamentNotifications() {
  // TODO: cablear fase 2
  return { counts: EMPTY, loading: false, refresh: async () => {} };
}
