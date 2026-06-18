// TODO: cablear fase 2
import { useQuery } from "@tanstack/react-query";

export interface AnalyticsOverview {
  active_players_30d: number;
  matches_30d: number;
  bookings_30d: number;
  revenue_30d_clp: number;
  occupancy_pct: number;
  tournaments_active: number;
  alerts_count: number;
}

export function useAnalyticsOverview() {
  // TODO: cablear fase 2
  return useQuery<AnalyticsOverview | null>({
    queryKey: ["stub-analytics-overview"],
    queryFn: async () => null,
    enabled: false,
  });
}
