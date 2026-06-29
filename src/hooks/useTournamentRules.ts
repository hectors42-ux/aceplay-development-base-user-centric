import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { FormatTableRow } from "@/lib/tournament-rule-templates";

export interface TournamentRules {
  id: string;
  tournament_id: string;
  version: number;
  is_current: boolean;
  descriptive_md: string | null;
  format_table_json: FormatTableRow[] | null;
  key_rules_md: string | null;
  tiebreak_rules_md: string | null;
  player_guide_md: string | null;
  operator_guide_md: string | null;
  image_rights_md: string | null;
  created_at: string;
  updated_at: string;
}

export type RulesPayload = Omit<
  TournamentRules,
  "id" | "tournament_id" | "version" | "is_current" | "created_at" | "updated_at"
>;

export const useTournamentRules = (tournamentId: string | null | undefined) => {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["tournament-rules", tournamentId],
    enabled: !!tournamentId,
    queryFn: async () => {
      const { data } = await supabase
        .from("tournament_rules")
        .select("*")
        .eq("tournament_id", tournamentId as string)
        .eq("is_current", true)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      return (data as TournamentRules | null) ?? null;
    },
  });
  return {
    rules: data ?? null,
    loading: isLoading,
    reload: async () => { await refetch(); },
    saveDraft: async (_payload: RulesPayload) => {},
    publish: async () => {},
  };
};
