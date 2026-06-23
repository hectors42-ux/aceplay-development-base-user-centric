// Hooks de la capa de medición del organizador (Épica D). Solo lectura de
// métricas CRUDAS + registro de ingresos; + la acción de finalizar un torneo.
// No deriva mérito ni ranking; no toca rating/xp/fichas.
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";

export interface OrganizerMetric {
  tournament_id: string; tournament_name: string; organizer_name: string | null; status: string | null;
  completion_rate: number | null; retention: number | null; data_quality: number | null; captured_at: string;
}
export interface RevenueEntry { id: string; organizer_name: string | null; type: string; amount_clp: number | null; ref: string | null; created_at: string }
export interface FinalizableTournament { tournament_id: string; name: string }

export const useOrganizerPanel = () => {
  const { user } = useAuth();
  return useQuery<OrganizerMetric[]>({
    queryKey: ["organizer-panel", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("organizer_panel");
      if (error) throw error;
      return (data as OrganizerMetric[] | null) ?? [];
    },
  });
};

export const useOrganizerRevenue = () => {
  const { user } = useAuth();
  return useQuery<RevenueEntry[]>({
    queryKey: ["organizer-revenue", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("organizer_revenue_panel");
      if (error) throw error;
      return (data as RevenueEntry[] | null) ?? [];
    },
  });
};

export const useOrganizerFinalizable = () => {
  const { user } = useAuth();
  return useQuery<FinalizableTournament[]>({
    queryKey: ["organizer-finalizable", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("organizer_finalizable");
      if (error) throw error;
      return (data as FinalizableTournament[] | null) ?? [];
    },
  });
};

export const useFinalizeTournament = () => {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (tournamentId: string) => {
      const { error } = await supabase.rpc("finalize_tournament", { _tournament_id: tournamentId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["organizer-panel"] });
      qc.invalidateQueries({ queryKey: ["organizer-finalizable"] });
    },
  });
};
