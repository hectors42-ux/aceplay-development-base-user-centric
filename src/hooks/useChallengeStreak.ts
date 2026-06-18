import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";

export interface ChallengeStreak {
  current_streak: number;
  longest_streak: number;
  last_week_start: string | null;
}

/**
 * Devuelve la racha de retas semanales del usuario.
 * Si nunca ha lanzado un desafío, retorna ceros.
 */
export const useChallengeStreak = () => {
  const { user } = useAuth();
  const [streak, setStreak] = useState<ChallengeStreak>({
    current_streak: 0,
    longest_streak: 0,
    last_week_start: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    let alive = true;
    const load = async () => {
      const { data } = await supabase
        .from("user_challenge_streaks")
        .select("current_streak, longest_streak, last_week_start")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!alive) return;
      if (data) setStreak(data as ChallengeStreak);
      setLoading(false);
    };
    void load();
    return () => {
      alive = false;
    };
  }, [user]);

  return { ...streak, loading };
};
