// Hooks de la sección Cancha (capa de conexión). SOLO leen y disparan las RPCs de
// M1 (que ya validamos que no premian ni mueven rating). Separados por deporte.
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import { useActiveSport } from "@/components/providers/SportProvider";
import { toast } from "sonner";

// ── Camino de ascenso (Addendum A · compute_ascension_path, solo lectura) ──────
export interface AscensionPath {
  current_category_label: string | null;
  next_category_label: string | null;
  points_needed: number;
  est_wins: number;
  est_basis: string;
  is_maxed: boolean;
}
export const useAscensionPath = () => {
  const { user } = useAuth();
  const { ratingSport } = useActiveSport();
  return useQuery<AscensionPath | null>({
    queryKey: ["ascension-path", ratingSport, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("compute_ascension_path", { _sport: ratingSport });
      if (error) throw error;
      return (data as AscensionPath[] | null)?.[0] ?? null;
    },
  });
};

// ── Agenda (challenges aceptados + retos de escalera; estado derivado on-read) ─
export interface AgendaItem {
  kind: "challenge" | "escalerilla";
  ref_id: string;
  opponent_id: string | null;
  opponent_name: string | null;
  opponent_avatar_url: string | null;
  opponent_avatar_kind: string | null;
  opponent_avatar_look: string | null;
  sport: string;
  space_id: string | null;
  space_name: string | null;
  slot: string | null;
  state: "por_jugar" | "vencido_sin_resultado" | "confirmado" | "por_confirmar";
  match_id: string | null;
}
export const useMatchAgenda = () => {
  const { user } = useAuth();
  return useQuery<AgendaItem[]>({
    queryKey: ["match-agenda", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_match_agenda");
      if (error) throw error;
      return (data as AgendaItem[] | null) ?? [];
    },
  });
};

// ── Sugeridos de Zona (suggest_partners) — preview para Conexión ──────────────
export interface SuggestedPartner {
  user_id: string;
  name: string | null;
  avatar_url: string | null;
  avatar_kind: string | null;
  avatar_look: string | null;
  nivel: number | null;
  rating: number | null;
  category: string | null;
  match_pct: number;
  shared_space_id: string | null;
  shared_space_name: string | null;
  recent_meetings: number;
}
export const useSuggestedPartners = (limit = 2) => {
  const { user } = useAuth();
  const { ratingSport } = useActiveSport();
  return useQuery<SuggestedPartner[]>({
    queryKey: ["suggested-partners", ratingSport, user?.id, limit],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("suggest_partners", { _sport: ratingSport, _limit: limit });
      if (error) throw error;
      return (data as SuggestedPartner[] | null) ?? [];
    },
  });
};

// ── Retos recibidos (para la noti del Inicio + bandeja) ───────────────────────
export interface ProfileMini {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  avatar_kind: string | null;
  avatar_look: string | null;
}
export interface ReceivedChallenge {
  id: string;
  sport: string;
  space_id: string | null;
  proposed_slots: string[];
  status: string;
  note: string | null;
  created_at: string;
  from_profile: ProfileMini | null;
  space: { name: string | null } | null;
}
export const useReceivedChallenges = () => {
  const { user } = useAuth();
  return useQuery<ReceivedChallenge[]>({
    queryKey: ["received-challenges", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("challenges")
        .select(
          "id, sport, space_id, proposed_slots, status, note, created_at, " +
            "from_profile:profiles!challenges_from_user_fkey(id, display_name, avatar_url, avatar_kind, avatar_look), " +
            "space:space!challenges_space_id_fkey(name)",
        )
        .eq("to_user", user!.id)
        .in("status", ["pending", "rescheduled"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as unknown as ReceivedChallenge[]) ?? [];
    },
  });
};

// ── Llamados abiertos de la comunidad (para la noti del Inicio) ───────────────
export interface CommunityCall {
  id: string;
  sport: string;
  slots: string[];
  space_id: string | null;
  scope: string;
  note: string | null;
  created_at: string;
  user_profile: ProfileMini | null;
  space: { name: string | null } | null;
}
export const useCommunityCalls = (limit = 5) => {
  const { user } = useAuth();
  const { ratingSport } = useActiveSport();
  const sportKey = ratingSport === "padel" ? "padel" : "tennis";
  return useQuery<CommunityCall[]>({
    queryKey: ["community-calls", sportKey, user?.id, limit],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("availability_calls")
        .select(
          "id, sport, slots, space_id, scope, note, created_at, " +
            "user_profile:profiles!availability_calls_user_id_fkey(id, display_name, avatar_url, avatar_kind, avatar_look), " +
            "space:space!availability_calls_space_id_fkey(name)",
        )
        .eq("status", "open")
        .eq("sport", sportKey)
        .neq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data as unknown as CommunityCall[]) ?? [];
    },
  });
};

// ── Mutaciones (disparan RPCs de M1; refrescan agenda + bandejas) ─────────────
const useCanchaRefresh = () => {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["received-challenges"] });
    qc.invalidateQueries({ queryKey: ["community-calls"] });
    qc.invalidateQueries({ queryKey: ["match-agenda"] });
  };
};

export const useRespondChallenge = () => {
  const refresh = useCanchaRefresh();
  return useMutation({
    mutationFn: async (vars: { id: string; action: "accept" | "reject" | "propose"; slot?: string }) => {
      const { error } = await supabase.rpc("respond_challenge", {
        _challenge_id: vars.id,
        _action: vars.action,
        _slot: vars.slot ?? null,
      });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      refresh();
      toast.success(vars.action === "accept" ? "Reto aceptado · agendado" : "Reto rechazado");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "No se pudo responder el reto"),
  });
};

export const useTakeAvailability = () => {
  const refresh = useCanchaRefresh();
  return useMutation({
    mutationFn: async (callId: string) => {
      const { data, error } = await supabase.rpc("take_availability", { _call_id: callId });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      refresh();
      toast.success("¡Partido tomado! Quedó en tu agenda.");
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "No se pudo tomar el llamado"),
  });
};
