import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAnalyticsFilters } from "./useAnalyticsFilters";

export interface MembersEngagement {
  total_members: number;
  avg_bookings_per_member: number;
  distribution: { C: number; B: number; A: number; sin_rating: number };
  at_risk: Array<{ user_id: string; name: string; member_since: string; last_activity: string | null }>;
  stars: Array<{ user_id: string; name: string; bookings_count: number }>;
  challenge_funnel: { enviados: number; aceptados: number; jugados: number };
  sport: string;
}

export function useAnalyticsMembers() {
  const { from, to, sport } = useAnalyticsFilters();
  return useQuery({
    queryKey: ["analytics", "members", from.toISOString(), to.toISOString(), sport],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("analytics_members_engagement", {
        p_from: from.toISOString(),
        p_to: to.toISOString(),
        p_sport: sport,
      });
      if (error) throw error;
      return data as unknown as MembersEngagement;
    },
    staleTime: 5 * 60 * 1000,
  });
}
