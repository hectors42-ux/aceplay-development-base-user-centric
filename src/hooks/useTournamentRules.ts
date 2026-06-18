import { useCallback, useEffect, useState } from "react";
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
  const [rules, setRules] = useState<TournamentRules | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!tournamentId) {
      setRules(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("tournament_rules" as never)
      .select("*")
      .eq("tournament_id", tournamentId)
      .eq("is_current", true)
      .maybeSingle();
    setRules((data as TournamentRules | null) ?? null);
    setLoading(false);
  }, [tournamentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const publish = useCallback(
    async (payload: RulesPayload) => {
      if (!tournamentId) throw new Error("Sin torneo");
      const { data, error } = await supabase.rpc("publish_tournament_rules" as never, {
        _tournament_id: tournamentId,
        _payload: payload as never,
      } as never);
      if (error) throw error;
      const row = data as unknown as TournamentRules;
      setRules(row);
      return row;
    },
    [tournamentId],
  );

  const saveDraft = useCallback(
    async (payload: RulesPayload) => {
      if (!tournamentId) throw new Error("Sin torneo");
      if (rules) {
        const { error } = await supabase
          .from("tournament_rules" as never)
          .update(payload as never)
          .eq("id", rules.id);
        if (error) throw error;
        await load();
      } else {
        // First draft: insert v1 as current
        const { error } = await supabase.from("tournament_rules" as never).insert({
          tournament_id: tournamentId,
          version: 1,
          is_current: true,
          ...payload,
        } as never);
        if (error) throw error;
        await load();
      }
    },
    [tournamentId, rules, load],
  );

  return { rules, loading, reload: load, saveDraft, publish };
};