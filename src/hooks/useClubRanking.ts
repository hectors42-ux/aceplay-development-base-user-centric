import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";

export type RankingSport = "tenis_singles" | "tenis_dobles" | "padel";

export interface ClubRankingRow {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  avatar_kind: string | null;
  avatar_look: string | null;
  level: number;
  reliability: number;
  matches_played: number;
  category: string | null;
  rank_position: number;
  prev_rank_position: number | null;
  streak: number;
  last_match_at: string | null;
}

/**
 * Ranking/escalafón del club para el deporte indicado, contra el RPC core
 * `club_ranking` (lee space_standing del club demo + player_ratings por deporte).
 */
export const useClubRanking = (sport: RankingSport) => {
  const { user } = useAuth();
  const [rows, setRows] = useState<ClubRankingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error: rpcError } = await supabase.rpc("club_ranking", { _sport: sport });
    if (rpcError) {
      console.error("[useClubRanking] error", rpcError);
      setError(rpcError.message);
      setRows([]);
      setLoading(false);
      return;
    }
    setError(null);
    setRows((data as ClubRankingRow[] | null) ?? []);
    setLoading(false);
  }, [user, sport]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { loading, rows, error, refresh };
};
