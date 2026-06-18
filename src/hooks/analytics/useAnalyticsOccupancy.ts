// TODO: cablear fase 2
import { useQuery } from "@tanstack/react-query";

export interface HeatmapCell {
  weekday: number;
  hour: number;
  occupancy_pct: number;
}

export function useAnalyticsOccupancy() {
  // TODO: cablear fase 2
  return useQuery<HeatmapCell[]>({
    queryKey: ["stub-analytics-occupancy"],
    queryFn: async () => [],
    enabled: false,
  });
}
