// TODO: cablear fase 2
import { useQuery } from "@tanstack/react-query";

export interface RoundRobinOpponent {
  registration_id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
}

export function useTournamentChallengeableOpponents(_categoryId: string | undefined) {
  // TODO: cablear fase 2
  return useQuery<RoundRobinOpponent[]>({
    queryKey: ["stub-tournament-challengeable-opponents"],
    queryFn: async () => [],
    enabled: false,
  });
}
