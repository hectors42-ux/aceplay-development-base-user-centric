// TODO: cablear fase 2
import { useQuery } from "@tanstack/react-query";

export interface FinanceSummary {
  bookings_collected_clp: number;
  bookings_pending_clp: number;
  classes_collected_clp: number;
  classes_pending_clp: number;
  tournaments_collected_clp: number;
  tournaments_pending_clp: number;
  total_collected_clp: number;
  total_pending_clp: number;
}

export function useAnalyticsFinance() {
  // TODO: cablear fase 2
  return useQuery<FinanceSummary | null>({
    queryKey: ["stub-analytics-finance"],
    queryFn: async () => null,
    enabled: false,
  });
}
