import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";

export type RankingFormat = "singles" | "doubles";

export interface GeneralRankingRow {
  user_id: string;
  name: string | null;
  avatar_url: string | null;
  avatar_kind: string | null;
  avatar_look: string | null;
  level: number;
  category: string | null;
  matches_played: number;
  reliability: number;
  rank_position: number;
  is_me: boolean;
}

// Ranking GENERAL por deporte + modalidad (3 pools de player_ratings). El RPC
// general_ranking es SECURITY DEFINER y expone SOLO Nivel 0–7 (jamás el Glicko
// crudo de otros). Respeta la guarda de menores y el opt-out de ranking.
export function useGeneralRanking(dbSport: "tennis" | "padel", format: RankingFormat) {
  const { user } = useAuth();
  // pádel solo tiene dobles (CHECK en la tabla): normaliza acá también.
  const fmt: RankingFormat = dbSport === "padel" ? "doubles" : format;
  return useQuery({
    queryKey: ["general-ranking", dbSport, fmt, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("general_ranking", { _sport: dbSport, _format: fmt });
      if (error) throw error;
      return (data as GeneralRankingRow[] | null) ?? [];
    },
  });
}
