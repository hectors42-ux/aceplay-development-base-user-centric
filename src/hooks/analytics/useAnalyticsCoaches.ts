// TODO: cablear fase 2
import { useQuery } from "@tanstack/react-query";

export interface CoachPerformance {
  coach_id: string;
  name: string;
  completed: number;
  pending_clp: number;
  paid_clp: number;
}

export function useAnalyticsCoaches() {
  // TODO: cablear fase 2
  return useQuery<CoachPerformance[]>({
    queryKey: ["stub-analytics-coaches"],
    queryFn: async () => [],
    enabled: false,
  });
}
