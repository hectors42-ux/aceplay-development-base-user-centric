// TODO: cablear fase 2
export interface ChallengeablePlayer {
  user_id: string;
  pos: number;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  level: number;
  level_diff: number;
  last_played_at: string | null;
  schedule_match: boolean;
  rematch: boolean;
  cooldown_blocked: boolean;
  score: number;
}

export const useChallengeablePlayers = (_ladderId: string | null) => {
  // TODO: cablear fase 2
  return {
    loading: false,
    rows: [] as ChallengeablePlayer[],
    error: null as string | null,
    refresh: async () => {},
  };
};
