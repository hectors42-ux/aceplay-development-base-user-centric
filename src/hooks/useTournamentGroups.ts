// TODO: cablear fase 2
export interface TournamentGroup {
  id: string;
  tournament_category_id: string;
  name: string;
  sort_order: number;
  registration_ids: string[];
}

export function useTournamentGroups(
  _categoryId: string | undefined,
  _matches: any[],
) {
  // TODO: cablear fase 2
  return { groups: [] as TournamentGroup[], loading: false, reload: async () => {} };
}
