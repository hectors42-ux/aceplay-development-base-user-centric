import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAnalyticsFilters } from "./useAnalyticsFilters";

export interface HeatmapCell {
  weekday: number;
  hour: number;
  court_id: string;
  court_name: string;
  occupied_count: number;
}

export function useAnalyticsOccupancy() {
  const { from, to, sport } = useAnalyticsFilters();
  return useQuery({
    queryKey: ["analytics", "occupancy", from.toISOString(), to.toISOString(), sport],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("analytics_occupancy_heatmap", {
        p_from: from.toISOString(),
        p_to: to.toISOString(),
        p_sport: sport,
      });
      if (error) throw error;
      return (data ?? []) as unknown as HeatmapCell[];
    },
    staleTime: 5 * 60 * 1000,
  });
}
