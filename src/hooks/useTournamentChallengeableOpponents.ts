import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface RoundRobinOpponent {
  user_id: string;
  registration_id: string;
  full_name: string | null;
  avatar_url: string | null;
  tournament_match_id: string;
  has_open_challenge: boolean;
}

export function useTournamentChallengeableOpponents(categoryId: string | undefined) {
  return useQuery({
    queryKey: ["rr-opponents", categoryId],
    enabled: !!categoryId,
    queryFn: async (): Promise<RoundRobinOpponent[]> => {
      const { data, error } = await supabase.rpc("get_round_robin_opponents" as never, {
        _category_id: categoryId,
      } as never);
      if (error) throw error;
      return (data ?? []) as unknown as RoundRobinOpponent[];
    },
  });
}