import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";

export interface PendingActions {
  loading: boolean;
  ladderChallengesReceived: number;
  ladderResultsToConfirm: number;
  tournamentResultsToConfirm: number;
  doublesInvitations: number;
  rescheduleRequests: number;
  partnerResultsToLoad: number;
  partnerResultsToConfirm: number;
  resultsToLoad: number;
  total: number;
}

const EMPTY: PendingActions = {
  loading: true,
  ladderChallengesReceived: 0,
  ladderResultsToConfirm: 0,
  tournamentResultsToConfirm: 0,
  doublesInvitations: 0,
  rescheduleRequests: 0,
  partnerResultsToLoad: 0,
  partnerResultsToConfirm: 0,
  resultsToLoad: 0,
  total: 0,
};

export const usePendingActions = (): PendingActions => {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["pending-actions", user?.id ?? null],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("home_pending_actions");
      if (error || !data || data.length === 0) {
        return null;
      }
      return data[0];
    },
    // Se actualiza con realtime en otros lados; mantener cache 60s suficiente
    staleTime: 60_000,
  });

  if (!user) return { ...EMPTY, loading: false };
  if (query.isLoading) return EMPTY;
  const r = query.data;
  if (!r) return { ...EMPTY, loading: false };

  return {
    loading: false,
    ladderChallengesReceived: r.ladder_challenges_received ?? 0,
    ladderResultsToConfirm: r.ladder_results_to_confirm ?? 0,
    tournamentResultsToConfirm: r.tournament_results_to_confirm ?? 0,
    doublesInvitations: r.doubles_invitations ?? 0,
    rescheduleRequests: r.reschedule_requests ?? 0,
    partnerResultsToLoad: (r as { partner_results_to_load?: number }).partner_results_to_load ?? 0,
    partnerResultsToConfirm: (r as { partner_results_to_confirm?: number }).partner_results_to_confirm ?? 0,
    resultsToLoad: (r as { results_to_load?: number }).results_to_load ?? 0,
    total: r.total ?? 0,
  };
};
