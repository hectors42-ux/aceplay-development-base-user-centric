// TODO: cablear fase 2
export type RankingSport = "tenis_singles" | "tenis_dobles" | "padel";

export interface ClubRankingRow {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  level: number;
  reliability: number;
  matches_played: number;
  category: string | null;
  rank_position: number;
  prev_rank_position: number | null;
  streak: number;
  last_match_at: string | null;
}

export const useClubRanking = (_sport: RankingSport) => {
  // TODO: cablear fase 2
  return {
    loading: false,
    rows: [] as ClubRankingRow[],
    error: null as string | null,
    refresh: async () => {},
  };
};
