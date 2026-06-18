import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAnalyticsFilters } from "./useAnalyticsFilters";

export interface AnalyticsOverview {
  occupancy_pct: number;
  prev_occupancy_pct: number;
  occupancy_delta_pp: number;
  active_members_30d: number;
  inactive_members_30d: number;
  morosos: number;
  active_tournaments: number;
  active_challenges: number;
  matches_played_week: number;
  clases_revenue_clp: number;
  top_coaches: Array<{ id: string; name: string | null; classes: number; revenue: number }>;
  health_score: number;
  sport: string;
}

export function useAnalyticsOverview() {
  const { from, to, sport } = useAnalyticsFilters();
  return useQuery({
    queryKey: ["analytics", "overview", from.toISOString(), to.toISOString(), sport],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("analytics_overview", {
        p_from: from.toISOString(),
        p_to: to.toISOString(),
        p_sport: sport,
      });
      if (error) throw error;
      return data as unknown as AnalyticsOverview;
    },
    staleTime: 5 * 60 * 1000,
  });
}
