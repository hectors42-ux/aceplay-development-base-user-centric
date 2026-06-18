// TODO: cablear fase 2
export interface PendingActions {
  loading: boolean;
  ladderChallengesReceived: number;
  ladderResultsToConfirm: number;
  tournamentResultsToConfirm: number;
  doublesInvitations: number;
  rescheduleRequests: number;
  partnerResultsToLoad: number;
  partnerResultsToConfirm: number;
  resultsToLoad: number;
  total: number;
}

const EMPTY: PendingActions = {
  loading: false,
  ladderChallengesReceived: 0,
  ladderResultsToConfirm: 0,
  tournamentResultsToConfirm: 0,
  doublesInvitations: 0,
  rescheduleRequests: 0,
  partnerResultsToLoad: 0,
  partnerResultsToConfirm: 0,
  resultsToLoad: 0,
  total: 0,
};

export const usePendingActions = (): PendingActions => {
  // TODO: cablear fase 2
  return EMPTY;
};
