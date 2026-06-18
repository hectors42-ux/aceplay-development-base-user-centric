// TODO: cablear fase 2
import { useQuery } from "@tanstack/react-query";

export interface DirectoryDigest {
  total_members: number;
  new_this_month: number;
  inactive_30d: number;
  consents_pending: number;
}

export function useAnalyticsDirectory(_month: Date = new Date()) {
  // TODO: cablear fase 2
  return useQuery<DirectoryDigest | null>({
    queryKey: ["stub-analytics-directory"],
    queryFn: async () => null,
    enabled: false,
  });
}
