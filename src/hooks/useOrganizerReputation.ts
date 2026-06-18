// TODO: cablear fase 2
import { useQuery } from "@tanstack/react-query";

export interface OrganizerReputation {
  user_id: string;
  tournaments_closed: number;
  champions_crowned: number;
  satisfaction_avg: number | null;
  badges: string[];
}

export function useOrganizerReputation(_userId: string | null | undefined) {
  // TODO: cablear fase 2
  return useQuery<OrganizerReputation | null>({
    queryKey: ["stub-organizer-reputation"],
    queryFn: async () => null,
    enabled: false,
  });
}
