import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import { useBookingsProvider } from "@/hooks/useBookingsProvider";

export interface HomeStats {
  loading: boolean;
  level: number | null;
  matchesPlayed: number;
  ladderPosition: number | null;
  hoursThisMonth: number;
}

const EMPTY: HomeStats = {
  loading: true,
  level: null,
  matchesPlayed: 0,
  ladderPosition: null,
  hoursThisMonth: 0,
};

export const useHomeStats = (): HomeStats => {
  const { user } = useAuth();
  const { isExternal } = useBookingsProvider();
  const [state, setState] = useState<HomeStats>(EMPTY);

  useEffect(() => {
    if (!user) {
      setState({ ...EMPTY, loading: false });
      return;
    }
    let cancel = false;
    (async () => {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      // Modo reservas externas: la tabla bookings está vacía/desactualizada
      // para el club → omitimos el cálculo y devolvemos 0 horas (la UI debe
      // ocultar el KPI cuando hoursThisMonth === 0 en modo externo).
      const [ratingRes, positionRes, bookingsRes] = await Promise.all([
        supabase
          .from("player_ratings")
          .select("level, competitive_matches")
          .eq("user_id", user.id)
          .order("competitive_matches", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("ladder_positions")
          .select("position, ladder_id, ladders!inner(is_active)")
          .eq("user_id", user.id)
          .eq("ladders.is_active", true)
          .order("position", { ascending: true })
          .limit(1)
          .maybeSingle(),
        isExternal
          ? Promise.resolve({ data: [] as { starts_at: string; ends_at: string }[] })
          : supabase
              .from("bookings")
              .select("starts_at, ends_at")
              .eq("user_id", user.id)
              .eq("status", "confirmada")
              .gte("starts_at", monthStart.toISOString())
              .lte("ends_at", new Date().toISOString()),
      ]);

      if (cancel) return;

      const hours = (bookingsRes.data ?? []).reduce((acc, b) => {
        const ms = new Date(b.ends_at).getTime() - new Date(b.starts_at).getTime();
        return acc + ms / (1000 * 60 * 60);
      }, 0);

      setState({
        loading: false,
        level: ratingRes.data?.level ?? null,
        matchesPlayed: ratingRes.data?.competitive_matches ?? 0,
        ladderPosition: positionRes.data?.position ?? null,
        hoursThisMonth: Math.round(hours * 10) / 10,
      });
    })();
    return () => {
      cancel = true;
    };
  }, [user, isExternal]);

  return state;
};
