// TODO: cablear fase 2
export type Category = any;
export type Tournament = any;
export type Registration = any;
export type Match = any;
export type ResultProposal = any;
export type RescheduleRequest = any;
export type Court = any;
export type TournamentPhase = any;
export type TournamentCourt = any;

export type Player = {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  ntrp_level?: number | null;
  club_ranking?: number | null;
};

export interface CategoryBundle {
  tournament: Tournament | null;
  category: Category | null;
  registrations: Registration[];
  matches: Match[];
  players: Map<string, Player>;
  pendingResults: ResultProposal[];
  pendingReschedules: RescheduleRequest[];
  courts: Court[];
  phases: TournamentPhase[];
  dedicatedCourtIds: string[];
}

const EMPTY_BUNDLE: CategoryBundle = {
  tournament: null,
  category: null,
  registrations: [],
  matches: [],
  players: new Map(),
  pendingResults: [],
  pendingReschedules: [],
  courts: [],
  phases: [],
  dedicatedCourtIds: [],
};

export function useCategoryBundle(_categoryId: string | undefined) {
  // TODO: cablear fase 2
  return {
    ...EMPTY_BUNDLE,
    loading: false,
    reload: async () => {},
    lastUpdatedAt: null as Date | null,
    refreshing: false,
    isLive: false,
  };
}

export function playerName(p: Player | undefined, fallback = "—"): string {
  if (!p) return fallback;
  return `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || fallback;
}

export function registrationLabel(
  reg: Registration | undefined,
  players: Map<string, Player>,
): string {
  if (!reg) return "BYE";
  const p1 = playerName(players.get(reg.player1_user_id), "Jugador 1");
  if (!reg.player2_user_id) return p1;
  const p2 = playerName(players.get(reg.player2_user_id), "Jugador 2");
  return `${p1} / ${p2}`;
}
