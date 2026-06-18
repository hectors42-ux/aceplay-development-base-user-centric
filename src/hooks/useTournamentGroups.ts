import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface TournamentGroup {
  id: string;
  tournament_category_id: string;
  name: string;
  sort_order: number;
  registration_ids: string[];
}

export function useTournamentGroups(
  categoryId: string | undefined,
  matches: { id: string; tournament_group_id?: string | null; phase?: string | null; registration_a_id: string | null; registration_b_id: string | null }[],
) {
  const [groups, setGroups] = useState<TournamentGroup[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!categoryId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("tournament_groups" as never)
      .select("id, tournament_category_id, name, sort_order")
      .eq("tournament_category_id", categoryId)
      .order("sort_order");
    setLoading(false);
    if (error || !data) {
      setGroups([]);
      return;
    }
    const rosters = new Map<string, Set<string>>();
    for (const m of matches) {
      if (!m.tournament_group_id) continue;
      let s = rosters.get(m.tournament_group_id);
      if (!s) {
        s = new Set();
        rosters.set(m.tournament_group_id, s);
      }
      if (m.registration_a_id) s.add(m.registration_a_id);
      if (m.registration_b_id) s.add(m.registration_b_id);
    }
    setGroups(
      (data as unknown as { id: string; tournament_category_id: string; name: string; sort_order: number }[]).map((g) => ({
        id: g.id,
        tournament_category_id: g.tournament_category_id,
        name: g.name,
        sort_order: g.sort_order,
        registration_ids: Array.from(rosters.get(g.id) ?? []),
      })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId, JSON.stringify(matches.map((m) => [m.id, m.tournament_group_id]))]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { groups, loading, reload };
}