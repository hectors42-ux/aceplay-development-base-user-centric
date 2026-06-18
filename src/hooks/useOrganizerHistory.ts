import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PodiumPlayer {
  registration_id: string;
}
export interface PodiumCategory {
  id: string;
  name: string;
  champion: PodiumPlayer | null;
  runner_up: PodiumPlayer | null;
  semis: PodiumPlayer[];
  matches_played: number;
  has_bracket: boolean;
}
export interface ClosingSummary {
  categories: PodiumCategory[];
  totals: { participants: number; matches_played: number };
  closed_at: string;
}

export interface OrganizerHistoryRow {
  tournament_id: string;
  organizer_user_id: string;
  tenant_id: string;
  name: string;
  slug: string;
  status: string;
  starts_at: string;
  ends_at: string;
  closed_at: string | null;
  closing_summary: ClosingSummary | null;
  participants_count: number;
  matches_played: number;
  sports: string[] | null;
}

export function useOrganizerHistory(userId: string | null | undefined) {
  return useQuery({
    queryKey: ["organizer-history", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizer_history")
        .select("*")
        .eq("organizer_user_id", userId!)
        .order("starts_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as OrganizerHistoryRow[];
    },
  });
}