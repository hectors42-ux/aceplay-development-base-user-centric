// TODO: cablear fase 2
export interface SuggestedMatchup {
  partner_user_id: string;
  partner_name: string;
  partner_avatar: string | null;
  rival_a_user_id: string;
  rival_a_name: string;
  rival_b_user_id: string;
  rival_b_name: string;
  score: number;
}

export const useSuggestedMatchup = () => {
  // TODO: cablear fase 2
  return {
    matchup: null as SuggestedMatchup | null,
    loading: false,
    refresh: async () => {},
  };
};
