import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type RankingSport = "tenis_singles" | "tenis_dobles" | "padel";

export interface ClubRankingRow {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  level: number;
  reliability: number;
  matches_played: number;
  category: string | null;
  rank_position: number;
  prev_rank_position: number | null;
  streak: number;
  last_match_at: string | null;
}

interface State {
  loading: boolean;
  rows: ClubRankingRow[];
  error: string | null;
}

/**
 * Devuelve el ranking del club por deporte (singles o dobles).
 * Ordenado por nivel descendente, con posición previa de hace 7 días.
 */
export const useClubRanking = (sport: RankingSport) => {
  const [state, setState] = useState<State>({ loading: true, rows: [], error: null });

  const refresh = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    const { data, error } = await supabase.rpc("get_club_ranking", {
      _sport: sport as Database["public"]["Enums"]["rating_sport"],
    });
    if (error) {
      setState({ loading: false, rows: [], error: error.message });
      return;
    }
    setState({
      loading: false,
      rows: (data ?? []) as unknown as ClubRankingRow[],
      error: null,
    });
  }, [sport]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { ...state, refresh };
};
