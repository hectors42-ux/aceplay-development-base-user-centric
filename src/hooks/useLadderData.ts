// TODO: cablear fase 2
export type LadderRow = any;
export type PositionRow = any;
export type ChallengeRow = any;
export type HistoryRow = any;
export type ProfileLite = {
  user_id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
};

interface State {
  loading: boolean;
  ladders: LadderRow[];
  selectedLadder: LadderRow | null;
  positions: PositionRow[];
  challenges: ChallengeRow[];
  history: HistoryRow[];
  profilesById: Record<string, ProfileLite>;
}

const EMPTY: State = {
  loading: false,
  ladders: [],
  selectedLadder: null,
  positions: [],
  challenges: [],
  history: [],
  profilesById: {},
};

export const useLadderData = () => {
  // TODO: cablear fase 2
  return {
    ...EMPTY,
    myPosition: null as PositionRow | null,
    setSelectedLadderId: (_id: string | null) => {},
    refresh: async () => {},
  };
};
