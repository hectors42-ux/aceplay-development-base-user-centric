import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import type { RatingSport } from "@/lib/rating-utils";

export interface FitSignal {
  value: number | null;
  hint: string;
}

export interface FitBreakdown {
  score: number;
  nivel: FitSignal;
  horarios: FitSignal;
  frecuencia: FitSignal;
  historial: FitSignal;
  edad: FitSignal;
  superficie: FitSignal;
}

export interface PartnerSuggestion {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  level: number | null;
  level_diff: number | null;
  compat_score: number | null;
  reasons: string[] | null;
  breakdown: FitBreakdown | null;
}

export const usePartnerSuggestions = (
  limit = 12,
  sport: RatingSport = "tenis_singles",
) => {
  const { user } = useAuth();
  const [rows, setRows] = useState<PartnerSuggestion[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase.rpc("get_partner_suggestions", {
      _limit: limit,
      _sport: sport,
    });
    if (!error && data) setRows(data as unknown as PartnerSuggestion[]);
    setLoading(false);
  }, [user, limit, sport]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { rows, loading, refresh };
};
