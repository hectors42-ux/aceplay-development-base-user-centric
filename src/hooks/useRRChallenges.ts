import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";

export interface RRChallenge {
  id: string;
  status: "pending" | "accepted" | "recorded";
  slot: string | null;
  i_am_challenger: boolean;
  rival: string;
  rival_name: string;
  proposed_winner: string | null;
  proposed_sets: { games_a: number; games_b: number; is_tiebreak: boolean }[] | null;
  recorded_by_me: boolean;
}

// Reto vivo del torneo (Fase A · solo entre participantes con cuenta). Suma a la
// tabla del torneo al confirmar; NO mueve el rating global (firewall).
export function useRRChallenges(categoryId?: string) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const key = ["rr-challenges", categoryId, user?.id];
  const list = useQuery<RRChallenge[]>({
    queryKey: key,
    enabled: !!categoryId && !!user,
    queryFn: async () => {
      const { data } = await supabase.rpc("rr_my_challenges", { _category_id: categoryId });
      return (data as RRChallenge[] | null) ?? [];
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["rr-challenges"] });
    qc.invalidateQueries({ queryKey: ["roster-rr-view"] });
    qc.invalidateQueries({ queryKey: ["rr-weighted-standings"] });
    qc.invalidateQueries({ queryKey: ["rr-progress"] });
  };
  const fail = (e: unknown) => toast.error(e instanceof Error ? e.message : "No se pudo completar");

  const send = useMutation({
    mutationFn: async (v: { opponent: string; slot?: string }) => {
      const { error } = await supabase.rpc("rr_send_challenge", { _category_id: categoryId, _opponent: v.opponent, _slot: v.slot ?? null });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Reto enviado."); refresh(); },
    onError: fail,
  });
  const respond = useMutation({
    mutationFn: async (v: { id: string; action: "accept" | "decline" | "cancel"; slot?: string }) => {
      const { error } = await supabase.rpc("rr_respond_challenge", { _challenge_id: v.id, _action: v.action, _slot: v.slot ?? null });
      if (error) throw error;
    },
    onSuccess: (_d, v) => { toast.success(v.action === "accept" ? "Reto aceptado." : v.action === "decline" ? "Reto rechazado." : "Reto cancelado."); refresh(); },
    onError: fail,
  });
  const record = useMutation({
    mutationFn: async (v: { id: string; winner: string; sets: { games_a: number; games_b: number; is_tiebreak: boolean }[] }) => {
      const { error } = await supabase.rpc("rr_challenge_record", { _challenge_id: v.id, _winner: v.winner, _sets: v.sets });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Resultado cargado · espera la confirmación del rival."); refresh(); },
    onError: fail,
  });
  const confirm = useMutation({
    mutationFn: async (v: { id: string; agree: boolean }) => {
      const { error } = await supabase.rpc("rr_challenge_confirm", { _challenge_id: v.id, _agree: v.agree });
      if (error) throw error;
    },
    onSuccess: (_d, v) => { toast.success(v.agree ? "Resultado confirmado · suma a la tabla." : "Resultado rechazado."); refresh(); },
    onError: fail,
  });

  return { challenges: list.data ?? [], loading: list.isLoading, send, respond, record, confirm };
}
