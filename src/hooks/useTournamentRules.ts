// TODO: cablear fase 2
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

export const useTournamentRules = (_tournamentId: string | null | undefined) => {
  // TODO: cablear fase 2
  return {
    rules: null as TournamentRules | null,
    loading: false,
    reload: async () => {},
    saveDraft: async (_payload: RulesPayload) => {},
    publish: async () => {},
  };
};
