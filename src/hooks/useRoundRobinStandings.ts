// Tabla de posiciones (round robin / grupos) — CABLEADA a tournament_standings.
// Solo lectura del estado del motor; no escribe nada.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface StandingRow {
  registration_id: string;
  player_name: string;
  matches_played: number;
  wins: number;
  losses: number;
  sets_won: number;
  sets_lost: number;
  position: number;
}

interface StandingRpcRow {
  pos: number;
  user_id: string;
  name: string | null;
  wins: number;
  played: number;
  set_diff: number;
  status: string;
}

export function useRoundRobinStandings(categoryId: string | undefined) {
  return useQuery<StandingRow[]>({
    queryKey: ["rr-standings", categoryId],
    enabled: !!categoryId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("tournament_standings", { _category_id: categoryId });
      if (error) throw error;
      const rows = (data as StandingRpcRow[] | null) ?? [];
      return rows.map((r) => ({
        registration_id: r.user_id,
        player_name: r.name ?? "—",
        matches_played: r.played,
        wins: r.wins,
        losses: Math.max(0, r.played - r.wins),
        // El motor expone diferencia de sets; aproximamos won/lost para conservar el signo.
        sets_won: Math.max(0, r.set_diff),
        sets_lost: Math.max(0, -r.set_diff),
        position: r.pos,
      }));
    },
  });
}
