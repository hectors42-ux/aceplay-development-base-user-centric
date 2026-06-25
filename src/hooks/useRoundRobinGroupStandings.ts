// Tabla por grupos (grupos→playoff) — CABLEADA a group_standings. Solo lectura.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface GroupStandingRow {
  registration_id: string;
  group_id: string;
  group_name: string;
  player_name: string;
  matches_played: number;
  wins: number;
  losses: number;
  sets_won: number;
  sets_lost: number;
  position: number;
}

interface RpcRow {
  grp: string;
  pos: number;
  user_id: string;
  name: string | null;
  wins: number;
  played: number;
  set_diff: number;
  status: string;
}

export function useRoundRobinGroupStandings(categoryId: string | undefined) {
  return useQuery<GroupStandingRow[]>({
    queryKey: ["rr-group-standings", categoryId],
    enabled: !!categoryId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("group_standings", { _category_id: categoryId });
      if (error) throw error;
      return ((data as RpcRow[] | null) ?? []).map((r) => ({
        registration_id: r.user_id,
        group_id: r.grp,
        group_name: r.grp,
        player_name: r.name ?? "—",
        matches_played: r.played,
        wins: r.wins,
        losses: Math.max(0, r.played - r.wins),
        sets_won: Math.max(0, r.set_diff),
        sets_lost: Math.max(0, -r.set_diff),
        position: r.pos,
      }));
    },
  });
}
