import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface OrganizerReputation {
  organizer_user_id: string;
  tournaments_closed: number;
  tournaments_total: number;
  verified_matches: number;
  confirmed_both_sides_pct: number;
  first_tournament_at: string | null;
}

export function useOrganizerReputation(userId: string | null | undefined) {
  return useQuery({
    queryKey: ["organizer-reputation", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizer_reputation")
        .select("*")
        .eq("organizer_user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as unknown as OrganizerReputation | null;
    },
  });
}