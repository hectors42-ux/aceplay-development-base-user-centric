// TODO: cablear fase 2
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
  _limit = 12,
  _sport: RatingSport = "tenis_singles",
) => {
  // TODO: cablear fase 2
  return { rows: [] as PartnerSuggestion[], loading: false, refresh: async () => {} };
};
