// TODO: cablear fase 2
import { useQuery } from "@tanstack/react-query";

export interface GroupStandingRow {
  registration_id: string;
  group_id: string;
  group_name: string;
  player_name: string;
  matches_played: number;
  wins: number;
  losses: number;
  sets_won: number;
  sets_lost: number;
  position: number;
}

export function useRoundRobinGroupStandings(_categoryId: string | undefined) {
  // TODO: cablear fase 2
  return useQuery<GroupStandingRow[]>({
    queryKey: ["stub-rr-group-standings"],
    queryFn: async () => [],
    enabled: false,
  });
}
