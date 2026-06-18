import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { RatingSport } from "@/lib/rating-utils";

export interface ProfileSummaryProfile {
  user_id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  member_since: string;
  bio: string | null;
  dominant_hand: "right" | "left" | "ambi" | null;
  backhand: "one_handed" | "two_handed" | null;
  favorite_shot: string | null;
  favorite_surface: "arcilla" | "cesped" | "dura" | "sintetico" | null;
  playing_style: string | null;
  availability: string | null;
  years_playing: number | null;
  email: string | null;
  phone: string | null;
  show_email: boolean;
  show_phone: boolean;
}

export interface ProfileSummaryRating {
  sport: RatingSport;
  level: number;
  reliability: number;
  last_change_delta: number;
  matches_played: number;
  last_match_at: string | null;
  category: "A" | "B" | "C" | null;
  best_level: number;
}

export interface ProfileSummaryRecentMatch {
  id: string;
  recorded_at: string;
  delta: number;
  level_after: number;
  source: string;
  source_ref_id: string | null;
  opponent_id: string | null;
  opponent_name?: string;
  opponent_avatar?: string | null;
  /** Marcador en formato "6-3, 4-6, 7-5" si existe (puede ser null para amistosos sin score). */
  score_summary?: string | null;
  /** Nombre del compañero en partidos de dobles. */
  partner_name?: string | null;
  won: boolean;
}

export interface ProfileSummaryBadge {
  id: string;
  awarded_at: string;
  code: string;
  name: string;
  description: string;
  icon: string;
  category: string;
}

export interface ProfileSummary {
  profile: ProfileSummaryProfile;
  rating: ProfileSummaryRating | null;
  positions: {
    ranking: number | null;
    ladder: number | null;
    ladder_status: string | null;
  };
  stats: {
    wins: number;
    losses: number;
    walkovers_for: number;
    walkovers_against: number;
    streak: number;
    streak_kind: "desafio_ganado" | "desafio_perdido" | null;
  };
  recent_matches: ProfileSummaryRecentMatch[];
  recent_badges: ProfileSummaryBadge[];
  sparkline: number[];
  flags: {
    is_owner: boolean;
    is_admin: boolean;
    show_email: boolean;
    show_phone: boolean;
  };
}

export const useUserProfileSummary = (userId: string | null, sport: RatingSport = "tenis_singles") => {
  const qc = useQueryClient();

  const query = useQuery<ProfileSummary | null>({
    queryKey: ["profile-summary", userId, sport],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase.rpc("user_profile_summary", {
        _user_id: userId,
        _sport: sport,
      });
      if (error) throw error;
      return data as unknown as ProfileSummary;
    },
  });

  const refresh = useCallback(async () => {
    if (!userId) return;
    await qc.invalidateQueries({ queryKey: ["profile-summary", userId, sport] });
  }, [qc, userId, sport]);

  return {
    data: query.data ?? null,
    loading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
    refresh,
  };
};
