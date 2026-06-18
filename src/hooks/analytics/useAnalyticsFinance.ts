import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAnalyticsFilters } from "./useAnalyticsFilters";

export interface FinanceSummary {
  clases_revenue_clp: number;
  cuotas_revenue_clp: number | null;
  reservas_revenue_clp: number | null;
  torneos_revenue_clp: number | null;
  morosos_total: number;
  morosos_30d: number;
  morosos_60d: number;
  morosos_90d: number;
  revenue_by_day: Array<{ day: string; clases: number }>;
  sport: string;
}

export function useAnalyticsFinance() {
  const { from, to, sport } = useAnalyticsFilters();
  return useQuery({
    queryKey: ["analytics", "finance", from.toISOString(), to.toISOString(), sport],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("analytics_finance_summary", {
        p_from: from.toISOString(),
        p_to: to.toISOString(),
        p_sport: sport,
      });
      if (error) throw error;
      return data as unknown as FinanceSummary;
    },
    staleTime: 5 * 60 * 1000,
  });
}
