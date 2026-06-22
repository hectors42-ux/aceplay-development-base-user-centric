import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PlayedMatchRow {
  id: string;
  recorded_at: string;
  delta: number;
  level_after: number;
  source: string;
  source_ref_id: string | null;
  opponent_id: string | null;
  score: unknown;
  won: boolean;
}

export interface PendingTournamentMatch {
  match_id: string;
  scheduled_at: string | null;
  created_at: string;
  round: number;
  category_id: string;
  category_name: string;
  tournament_slug: string;
  tournament_name: string;
  opponent_name: string;
  /** Hay alguna propuesta de resultado en estado 'propuesto' (de cualquier jugador) */
  has_pending_proposal: boolean;
  /**
   * Acción requerida del usuario actual, igual semántica que Escalerilla:
   * - "submit"  → nadie cargó el resultado todavía
   * - "confirm" → el rival propuso, debes aceptar/rechazar
   * - "wait"    → tú propusiste, esperando al rival
   */
  needs_action: "submit" | "confirm" | "wait";
}

export interface PendingLadderMatch {
  challenge_id: string;
  scheduled_at: string | null;
  created_at: string;
  status: string;
  result_proposed_by: string | null;
  result_proposed_at: string | null;
  ladder_id: string;
  ladder_name: string;
  opponent_id: string;
  opponent_name: string;
  /** "submit" = nadie propuso resultado | "confirm" = el rival propuso, debes confirmar | "wait" = tú propusiste, espera al rival */
  needs_action: "submit" | "confirm" | "wait";
}

export interface MatchHistoryData {
  played: PlayedMatchRow[];
  pending_tournaments: PendingTournamentMatch[];
  pending_ladder: PendingLadderMatch[];
  is_self: boolean;
  limit: number;
}

const EMPTY: MatchHistoryData = {
  played: [],
  pending_tournaments: [],
  pending_ladder: [],
  is_self: false,
  limit: 0,
};

export function useMatchHistory(userId: string | null, opts?: { enabled?: boolean; limit?: number }) {
  const limit = opts?.limit ?? 50;
  const enabled = (opts?.enabled ?? true) && !!userId;

  return useQuery<MatchHistoryData>({
    queryKey: ["match-history", userId, limit],
    enabled,
    queryFn: async () => {
      if (!userId) return EMPTY;
      const { data, error } = await supabase.rpc("user_match_history", {
        _user_id: userId,
        _limit: limit,
      });
      if (error) throw error;
      const obj = (data ?? {}) as Partial<MatchHistoryData>;
      return {
        played: obj.played ?? [],
        pending_tournaments: obj.pending_tournaments ?? [],
        pending_ladder: obj.pending_ladder ?? [],
        is_self: obj.is_self ?? false,
        limit: obj.limit ?? 0,
      };
    },
    // Refetch siempre que se abra el sheet para garantizar datos del usuario actual
    // (evita ver datos cacheados de una sesión anterior).
    staleTime: 0,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnMount: "always",
  });
}
