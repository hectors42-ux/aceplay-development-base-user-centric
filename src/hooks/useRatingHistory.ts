import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import type { RatingHistoryRow } from "@/lib/rating-utils";

/**
 * Devuelve los últimos N cambios de rating del usuario (default 20).
 */
export const useRatingHistory = (limit = 20) => {
  const { user } = useAuth();
  const [history, setHistory] = useState<RatingHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setHistory([]);
      setLoading(false);
      return;
    }
    setLoading(true);

    void supabase
      .from("rating_history")
      .select("*")
      .eq("user_id", user.id)
      .order("recorded_at", { ascending: false })
      .limit(limit)
      .then(({ data, error }) => {
        if (error) {
          console.error("[useRatingHistory]", error);
          setHistory([]);
        } else {
          setHistory((data as RatingHistoryRow[]) ?? []);
        }
        setLoading(false);
      });
  }, [user, limit]);

  return { history, loading };
};
