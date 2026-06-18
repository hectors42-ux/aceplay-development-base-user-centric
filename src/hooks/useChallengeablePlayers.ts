import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ChallengeablePlayer {
  user_id: string;
  pos: number;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  level: number;
  level_diff: number;
  last_played_at: string | null;
  schedule_match: boolean;
  rematch: boolean;
  cooldown_blocked: boolean;
  score: number;
}

interface State {
  loading: boolean;
  rows: ChallengeablePlayer[];
  error: string | null;
}

/**
 * Devuelve la lista de rivales que puedo desafiar en una Pirámide,
 * ordenados por score de compatibilidad (rating, actividad, horarios, revancha).
 */
export const useChallengeablePlayers = (ladderId: string | null) => {
  const [state, setState] = useState<State>({ loading: false, rows: [], error: null });

  const refresh = useCallback(async () => {
    if (!ladderId) {
      setState({ loading: false, rows: [], error: null });
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    const { data, error } = await supabase.rpc("get_challengeable_players", {
      _ladder_id: ladderId,
    });
    if (error) {
      setState({ loading: false, rows: [], error: error.message });
      return;
    }
    setState({
      loading: false,
      rows: (data ?? []) as unknown as ChallengeablePlayer[],
      error: null,
    });
  }, [ladderId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { ...state, refresh };
};
