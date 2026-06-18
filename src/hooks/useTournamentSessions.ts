// TODO: cablear fase 2
export type TournamentSession = {
  id: string;
  tournament_id: string;
  tenant_id: string;
  name: string;
  starts_at: string;
  ends_at: string;
  court_ids: string[];
  block_label: string;
  status: "planificada" | "bloqueada" | "en_curso" | "finalizada";
  created_at: string;
  created_by: string;
};

export const useTournamentSessions = (_tournamentId: string | null | undefined) => {
  // TODO: cablear fase 2
  return { sessions: [] as TournamentSession[], loading: false, reload: async () => {} };
};
