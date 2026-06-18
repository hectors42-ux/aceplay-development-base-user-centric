// TODO: cablear fase 2
type Match = any;
type Round = any;
type Category = any;
type Tournament = any;

export type OperatorPlayer = {
  user_id: string;
  display_name: string;
  first_name: string;
  last_name: string;
};

export type CourtMatchView = {
  match: Match;
  liveStatus: "calentando" | "en_juego" | "cerrado";
  courtLabel: string;
  sideA: OperatorPlayer[];
  sideB: OperatorPlayer[];
};

export type OperatorRoundView = {
  round: Round;
  category: Category;
  courts: CourtMatchView[];
  totalMatches: number;
  closedMatches: number;
  allClosed: boolean;
};

export type OperatorBoardState = {
  tournament: Tournament | null;
  rounds: OperatorRoundView[];
  loading: boolean;
  reload: () => Promise<void>;
};

export function useOperatorBoard(_slug: string | undefined) {
  // TODO: cablear fase 2
  return {
    tournament: null as Tournament | null,
    rounds: [] as OperatorRoundView[],
    loading: false,
    reload: async () => {},
    allCategories: [] as Category[],
    players: new Map<string, OperatorPlayer>(),
  } as OperatorBoardState & {
    allCategories: Category[];
    players: Map<string, OperatorPlayer>;
  };
}
