// TODO: cablear fase 2
import { useQuery } from "@tanstack/react-query";

export interface PendingPartnerMatch {
  id: string;
  starts_at: string;
  court_name: string | null;
  partner_user_id: string;
  partner_name: string;
  partner_avatar: string | null;
}

export function usePartnerPendingResults() {
  // TODO: cablear fase 2
  return useQuery<PendingPartnerMatch[]>({
    queryKey: ["stub-partner-pending-results"],
    queryFn: async () => [],
    enabled: false,
  });
}
