// TODO: cablear fase 2
export interface RecentPartner {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  last_played_at: string | null;
  matches_count: number;
}

export const useRecentPartners = (_limit = 8) => {
  // TODO: cablear fase 2
  return { rows: [] as RecentPartner[], loading: false };
};
