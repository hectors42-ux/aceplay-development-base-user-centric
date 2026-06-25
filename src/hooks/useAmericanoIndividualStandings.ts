// Tabla individual de Americano — CABLEADA a americano_standings. Solo lectura.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AmericanoStandingRow {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  matches_played: number;
  games_won: number;
  games_lost: number;
  points: number;
  position: number;
}

interface RpcRow {
  pos: number;
  user_id: string;
  name: string | null;
  points: number;
  played: number;
}

export function useAmericanoIndividualStandings(categoryId: string | undefined) {
  const query = useQuery<AmericanoStandingRow[]>({
    queryKey: ["americano-standings", categoryId],
    enabled: !!categoryId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("americano_standings", { _category_id: categoryId });
      if (error) throw error;
      return ((data as RpcRow[] | null) ?? []).map((r) => {
        const parts = (r.name ?? "").split(" ");
        return {
          user_id: r.user_id,
          first_name: parts[0] || null,
          last_name: parts.slice(1).join(" ") || null,
          avatar_url: null,
          matches_played: r.played,
          // El motor expone PUNTOS del americano, no games ganados/perdidos → 0 (la UI usa points).
          games_won: 0,
          games_lost: 0,
          points: r.points,
          position: r.pos,
        };
      });
    },
  });
  return { rows: query.data ?? [], loading: query.isLoading, reload: async () => { await query.refetch(); } };
}
