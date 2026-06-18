import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAnalyticsFilters } from "./useAnalyticsFilters";

export interface CommunityStats {
  avg_accept_hours: number;
  avg_play_hours: number;
  active_ladders: Array<{ ladder_id: string; name: string; matches: number }>;
  top_progress: Array<{ user_id: string; name: string; delta: number }>;
  top_decline: Array<{ user_id: string; name: string; delta: number }>;
  level_density: Array<{ bucket: number; count: number }>;
  sport: string;
}

export function useAnalyticsCommunity() {
  const { from, to, sport } = useAnalyticsFilters();
  return useQuery({
    queryKey: ["analytics", "community", from.toISOString(), to.toISOString(), sport],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("analytics_community_stats", {
        p_from: from.toISOString(),
        p_to: to.toISOString(),
        p_sport: sport,
      });
      if (error) throw error;
      return data as unknown as CommunityStats;
    },
    staleTime: 5 * 60 * 1000,
  });
}
