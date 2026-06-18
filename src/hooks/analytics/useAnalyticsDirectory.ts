import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAnalyticsFilters } from "./useAnalyticsFilters";

export interface DirectoryDigest {
  month: string;
  sport: string;
  overview: Record<string, unknown> & { occupancy_pct: number; active_members_30d: number; morosos: number; health_score: number };
  finance: Record<string, unknown>;
  engagement: Record<string, unknown>;
  wins: string[];
  risks: string[];
}

export function useAnalyticsDirectory(month: Date = new Date()) {
  const { sport } = useAnalyticsFilters();
  const monthStr = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}-01`;
  return useQuery({
    queryKey: ["analytics", "directory", monthStr, sport],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("analytics_directory_digest", {
        p_month: monthStr,
        p_sport: sport,
      });
      if (error) throw error;
      return data as unknown as DirectoryDigest;
    },
    staleTime: 10 * 60 * 1000,
  });
}
