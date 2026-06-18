import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import { useActiveSport } from "@/components/providers/SportProvider";
import type { PlayerRatingRow, RatingSport } from "@/lib/rating-utils";

interface State {
  rating: PlayerRatingRow | null;
  loading: boolean;
  hasOnboarding: boolean;
}

/**
 * Devuelve el rating principal del usuario en el deporte indicado (o el
 * deporte activo del SportProvider si no se pasa argumento).
 */
export const useMyRating = (sport?: RatingSport) => {
  const { user } = useAuth();
  const { ratingSport } = useActiveSport();
  const effectiveSport: RatingSport = sport ?? ratingSport;
  const [state, setState] = useState<State>({
    rating: null,
    loading: true,
    hasOnboarding: false,
  });

  const refresh = useCallback(async () => {
    if (!user) {
      setState({ rating: null, loading: false, hasOnboarding: false });
      return;
    }
    setState((s) => ({ ...s, loading: true }));

    const { data, error } = await supabase
      .from("player_ratings")
      .select("*")
      .eq("user_id", user.id)
      .eq("sport", effectiveSport)
      .order("matches_played", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[useMyRating] error", error);
      setState({ rating: null, loading: false, hasOnboarding: false });
      return;
    }

    setState({
      rating: (data as PlayerRatingRow | null) ?? null,
      loading: false,
      hasOnboarding: !!data?.onboarding_completed_at,
    });
  }, [user, effectiveSport]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { ...state, refresh };
};
