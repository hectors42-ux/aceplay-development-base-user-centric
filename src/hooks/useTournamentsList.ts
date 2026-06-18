// TODO: cablear fase 2
export type RecentEnrollee = {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  registered_at: string;
};

export type TournamentListItem = any & {
  tournament_categories: any[];
  tournament_cobrand: any | null;
  enrolled_count: number;
  capacity: number;
  recent_enrolled: RecentEnrollee[];
  user_registration: {
    id: string;
    tournament_category_id: string;
    status: any;
  } | null;
  user_past_result: string | null;
};

export function useTournamentsList() {
  // TODO: cablear fase 2
  return {
    tournaments: [] as TournamentListItem[],
    loading: false,
    userActiveTournaments: [] as TournamentListItem[],
    userHistory: [] as TournamentListItem[],
  };
}
