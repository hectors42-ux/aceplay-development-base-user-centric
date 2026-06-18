// TODO: cablear fase 2
export type OperatorRow = {
  tournament_id: string;
  user_id: string;
  granted_by: string;
  granted_at: string;
};

export function useTournamentOperators(_tournamentId: string | undefined | null) {
  // TODO: cablear fase 2
  const operators: OperatorRow[] = [];
  return {
    operators,
    loading: false,
    isOperator: (_uid: string) => false,
  };
}
