// TODO: cablear fase 2
export interface ChallengeStreak {
  current_streak: number;
  longest_streak: number;
  last_week_start: string | null;
}

export const useChallengeStreak = () => {
  // TODO: cablear fase 2
  return {
    current_streak: 0,
    longest_streak: 0,
    last_week_start: null as string | null,
    loading: false,
  };
};
