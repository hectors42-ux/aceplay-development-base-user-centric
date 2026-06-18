// TODO: cablear fase 2
import { useQuery } from "@tanstack/react-query";

export interface MembersEngagement {
  active_7d: number;
  active_30d: number;
  active_90d: number;
  churn_risk: number;
}

export function useAnalyticsMembers() {
  // TODO: cablear fase 2
  return useQuery<MembersEngagement | null>({
    queryKey: ["stub-analytics-members"],
    queryFn: async () => null,
    enabled: false,
  });
}
