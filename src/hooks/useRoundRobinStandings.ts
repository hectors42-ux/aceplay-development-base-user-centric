// TODO: cablear fase 2
import { useQuery } from "@tanstack/react-query";

export interface StandingRow {
  registration_id: string;
  player_name: string;
  matches_played: number;
  wins: number;
  losses: number;
  sets_won: number;
  sets_lost: number;
  position: number;
}

export function useRoundRobinStandings(_categoryId: string | undefined) {
  // TODO: cablear fase 2
  return useQuery<StandingRow[]>({
    queryKey: ["stub-rr-standings"],
    queryFn: async () => [],
    enabled: false,
  });
}
