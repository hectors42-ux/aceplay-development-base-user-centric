// TODO: cablear fase 2
import { useQuery } from "@tanstack/react-query";

export interface CommunityStats {
  matches_30d: number;
  active_players_30d: number;
  partner_invitations_30d: number;
  tournaments_active: number;
}

export function useAnalyticsCommunity() {
  // TODO: cablear fase 2
  return useQuery<CommunityStats | null>({
    queryKey: ["stub-analytics-community"],
    queryFn: async () => null,
    enabled: false,
  });
}
