// TODO: cablear fase 2
import { useQuery } from "@tanstack/react-query";

export interface AnalyticsAlert {
  id: string;
  level: string;
  title: string;
  description: string | null;
  created_at: string;
}

export function useAnalyticsAlerts() {
  // TODO: cablear fase 2
  return useQuery<AnalyticsAlert[]>({
    queryKey: ["stub-analytics-alerts"],
    queryFn: async () => [],
    enabled: false,
  });
}
