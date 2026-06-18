import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";

export interface SuggestedMatchup {
  id: string;
  tenant_id: string;
  week_start: string;
  player_a_id: string;
  player_b_id: string;
  level_a: number | null;
  level_b: number | null;
  level_diff: number | null;
  score: number;
  reason: string | null;
  computed_at: string;
  player_a?: {
    user_id: string;
    first_name: string;
    last_name: string;
    avatar_url: string | null;
  };
  player_b?: {
    user_id: string;
    first_name: string;
    last_name: string;
    avatar_url: string | null;
  };
}

const weekStart = () => {
  const d = new Date();
  const day = d.getDay(); // 0 domingo
  const diff = day === 0 ? -6 : 1 - day; // lunes
  const ws = new Date(d);
  ws.setDate(d.getDate() + diff);
  ws.setHours(0, 0, 0, 0);
  return ws.toISOString().slice(0, 10);
};

/**
 * Obtiene el mejor matchup sugerido del club para la semana actual.
 * Si no existe, lo computa on-demand vía RPC.
 */
export const useSuggestedMatchup = () => {
  const { profile } = useAuth();
  const [matchup, setMatchup] = useState<SuggestedMatchup | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!profile?.tenant_id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const ws = weekStart();
    const { data: existing } = await supabase
      .from("suggested_matchup_of_the_week")
      .select("*")
      .eq("tenant_id", profile.tenant_id)
      .eq("week_start", ws)
      .maybeSingle();

    let row = existing as SuggestedMatchup | null;
    if (!row) {
      const { data: computed } = await supabase.rpc("compute_suggested_matchup", {
        _tenant_id: profile.tenant_id,
      });
      row = computed as unknown as SuggestedMatchup | null;
    }

    if (row) {
      const { data: profiles } = await supabase
        .from("profiles_directory")
        .select("user_id, first_name, last_name, avatar_url")
        .in("user_id", [row.player_a_id, row.player_b_id]);
      const map = (profiles ?? []).reduce<Record<string, SuggestedMatchup["player_a"]>>(
        (acc, p) => {
          acc[p.user_id] = p as SuggestedMatchup["player_a"];
          return acc;
        },
        {},
      );
      row.player_a = map[row.player_a_id];
      row.player_b = map[row.player_b_id];
    }

    setMatchup(row);
    setLoading(false);
  }, [profile?.tenant_id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { matchup, loading, refresh };
};
