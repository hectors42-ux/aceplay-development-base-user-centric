// TODO: cablear fase 2
import { useState } from "react";

export interface RoundMatch {
  id: string;
  round: number;
  bracket_position: number;
  court_id: string | null;
  status: string;
  side_a_user_ids: string[];
  side_b_user_ids: string[];
  americano_round_id: string | null;
  scheduled_at: string | null;
}
export interface PlayerLite {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
}
export interface RegistrationLite {
  player1_user_id: string;
  session_availability: string[] | null;
}

export function useRoundPairs(_opts: {
  roundId: string | undefined;
  categoryId: string | undefined;
  tournamentId: string | undefined;
}) {
  // TODO: cablear fase 2
  const [matches, setMatches] = useState<RoundMatch[]>([]);
  return {
    matches,
    setMatches,
    players: new Map<string, PlayerLite>(),
    availabilityByUser: new Map<string, string[]>(),
    loading: false,
    reload: async () => {},
  };
}
