// TODO: cablear fase 2
import { useQuery } from "@tanstack/react-query";

export interface CoachWithProfile {
  id: string;
  user_id: string;
  bio: string | null;
  hourly_rate_clp: number | null;
  sports: string[];
  is_active: boolean;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
}

export const useCoaches = (_sportOverride?: any) => {
  // TODO: cablear fase 2
  return useQuery<CoachWithProfile[]>({
    queryKey: ["stub-coaches"],
    queryFn: async () => [],
    enabled: false,
  });
};

export const useMyCoachProfile = () => {
  // TODO: cablear fase 2
  return useQuery<any | null>({
    queryKey: ["stub-my-coach-profile"],
    queryFn: async () => null,
    enabled: false,
  });
};
