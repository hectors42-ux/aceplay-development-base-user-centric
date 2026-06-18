import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import type { PlayerRatingRow } from "@/lib/rating-utils";

export type ClubCategory = "A" | "B" | "C";

interface State {
  rating: PlayerRatingRow | null;
  category: ClubCategory | null;
  loading: boolean;
  hasOnboarding: boolean;
}

/**
 * Devuelve el rating principal del usuario + su categoría derivada (A/B/C).
 */
export const useMyRatingWithCategory = () => {
  const { user } = useAuth();
  const [state, setState] = useState<State>({
    rating: null,
    category: null,
    loading: true,
    hasOnboarding: false,
  });

  const refresh = useCallback(async () => {
    if (!user) {
      setState({ rating: null, category: null, loading: false, hasOnboarding: false });
      return;
    }
    setState((s) => ({ ...s, loading: true }));

    const { data: rating, error } = await supabase
      .from("player_ratings")
      .select("*")
      .eq("user_id", user.id)
      .order("matches_played", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[useMyRatingWithCategory] error", error);
      setState({ rating: null, category: null, loading: false, hasOnboarding: false });
      return;
    }

    let category: ClubCategory | null = null;
    if (rating) {
      const { data: cat } = await supabase.rpc("get_player_category", {
        _level: rating.level,
        _tenant_id: rating.tenant_id,
      });
      if (cat === "A" || cat === "B" || cat === "C") category = cat;
    }

    setState({
      rating: (rating as PlayerRatingRow | null) ?? null,
      category,
      loading: false,
      hasOnboarding: !!rating?.onboarding_completed_at,
    });
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { ...state, refresh };
};
