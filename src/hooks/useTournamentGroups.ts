// Grupos de una categoría (grupos→playoff) — DERIVADOS de group_standings.
// Solo lectura; no toca el motor.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TournamentGroup {
  id: string;
  tournament_category_id: string;
  name: string;
  sort_order: number;
  registration_ids: string[];
}

interface RpcRow {
  grp: string;
  pos: number;
  user_id: string;
}

export function useTournamentGroups(categoryId: string | undefined, _matches: unknown[]) {
  const query = useQuery<TournamentGroup[]>({
    queryKey: ["tournament-groups", categoryId],
    enabled: !!categoryId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("group_standings", { _category_id: categoryId });
      if (error) throw error;
      const rows = (data as RpcRow[] | null) ?? [];
      const byGroup = new Map<string, string[]>();
      for (const r of rows) {
        const list = byGroup.get(r.grp) ?? [];
        list.push(r.user_id);
        byGroup.set(r.grp, list);
      }
      return [...byGroup.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([grp, ids], i) => ({
          id: grp,
          tournament_category_id: categoryId!,
          name: grp,
          sort_order: i,
          registration_ids: ids,
        }));
    },
  });
  return {
    groups: query.data ?? [],
    loading: query.isLoading,
    reload: async () => {
      await query.refetch();
    },
  };
}
