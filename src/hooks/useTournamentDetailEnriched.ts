// TODO: cablear fase 2
export type TournamentRow = any;
export type TournamentCategoryRow = any;

interface EnrichedState {
  tournament: TournamentRow | null;
  categories: TournamentCategoryRow[];
  enrolledByCat: Record<string, number>;
  totalEnrolled: number;
  totalCapacity: number;
  daysToClose: number | null;
  isEnrolled: boolean;
  myCategoryId: string | null;
  loading: boolean;
}

const initial: EnrichedState = {
  tournament: null,
  categories: [],
  enrolledByCat: {},
  totalEnrolled: 0,
  totalCapacity: 0,
  daysToClose: null,
  isEnrolled: false,
  myCategoryId: null,
  loading: false,
};

export function useTournamentDetailEnriched(_slug: string | undefined) {
  // TODO: cablear fase 2
  return initial;
}
