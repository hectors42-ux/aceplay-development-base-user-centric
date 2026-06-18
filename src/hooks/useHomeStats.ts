// TODO: cablear fase 2
export interface HomeStats {
  loading: boolean;
  level: number | null;
  matchesPlayed: number;
  ladderPosition: number | null;
  hoursThisMonth: number;
}

const EMPTY: HomeStats = {
  loading: false,
  level: null,
  matchesPlayed: 0,
  ladderPosition: null,
  hoursThisMonth: 0,
};

export const useHomeStats = (): HomeStats => {
  // TODO: cablear fase 2
  return EMPTY;
};
