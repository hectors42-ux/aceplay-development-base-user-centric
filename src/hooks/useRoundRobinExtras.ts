import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";

export interface RRProgress {
  participants: number;
  played: number;
  possible: number;
  remaining: number;
  pct: number;
  closes_at: string | null;
  prize_top: number;
  asado_bottom: number;
}

// Avance del torneo RR + corte + zonas (premio/asado). SOLO LECTURA.
export function useRRProgress(categoryId?: string) {
  return useQuery<RRProgress | null>({
    queryKey: ["rr-progress", categoryId],
    enabled: !!categoryId,
    queryFn: async () => {
      const { data } = await supabase.rpc("round_robin_progress", { _category_id: categoryId });
      return ((data as RRProgress[] | null) ?? [])[0] ?? null;
    },
  });
}

// "A quién reto": rivales que el usuario actual aún no enfrentó en esta categoría.
export function useRRPending(categoryId?: string) {
  const { user } = useAuth();
  return useQuery<{ roster_player_id: string; display_name: string }[]>({
    queryKey: ["rr-pending", categoryId, user?.id],
    enabled: !!categoryId && !!user,
    queryFn: async () => {
      const { data } = await supabase.rpc("round_robin_pending", { _category_id: categoryId });
      return (data as { roster_player_id: string; display_name: string }[] | null) ?? [];
    },
  });
}
