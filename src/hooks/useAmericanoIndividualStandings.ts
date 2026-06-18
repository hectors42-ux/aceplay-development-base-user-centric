// TODO: cablear fase 2
export interface AmericanoStandingRow {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  matches_played: number;
  games_won: number;
  games_lost: number;
  points: number;
  position: number;
}

export function useAmericanoIndividualStandings(_categoryId: string | undefined) {
  // TODO: cablear fase 2
  return { rows: [] as AmericanoStandingRow[], loading: false, reload: async () => {} };
}
