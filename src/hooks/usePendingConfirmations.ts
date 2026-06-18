// TODO: cablear fase 2
export interface PendingConfirmationMatch {
  id: string;
  tournament_id: string;
  tournament_name: string;
  tournament_slug: string;
  category_name: string;
  proposed_by_user_id: string;
  proposed_by_name: string;
  sets: Array<{ a: number; b: number }>;
  proposed_at: string;
  is_walkover: boolean;
}

export function usePendingConfirmations() {
  // TODO: cablear fase 2
  return {
    matches: [] as PendingConfirmationMatch[],
    loading: false,
    reload: async () => {},
  };
}
