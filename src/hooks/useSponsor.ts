import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { resolveSponsor, currentWindowKey, type SponsorCandidate } from "@/lib/sponsor";

export type SponsorScope = "tournament" | "ladder" | "club" | "store" | "discover" | "home";

/**
 * Devuelve el placement de marca ganador para una superficie (scope) y, opcional,
 * una entidad concreta (refId). Prioridad pagada > weight > rotación temporal.
 */
export function useSponsor(scope: SponsorScope, refId?: string | null) {
  const q = useQuery<SponsorCandidate[]>({
    queryKey: ["sponsor", scope, refId ?? null],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("sponsor_candidates", { _scope: scope, _ref_id: refId ?? null });
      if (error) throw error;
      return (data as SponsorCandidate[] | null) ?? [];
    },
    staleTime: 5 * 60_000,
  });
  const sponsor = resolveSponsor(q.data ?? [], currentWindowKey(Date.now()));
  return { sponsor, isLoading: q.isLoading };
}
