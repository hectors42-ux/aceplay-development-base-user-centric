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
    qc.invalidateQueries({ queryKey: ["availability-feed"] });
  };
};

// ── Feed de llamados enriquecido (availability_feed · solo lectura, M4) ────────
export interface FeedCall {
  id: string;
  user_id: string;
  name: string | null;
  avatar_url: string | null;
  avatar_kind: string | null;
  avatar_look: string | null;
  poster_nivel: number | null;
  poster_category: string | null;
  slots: string[];
  space_id: string | null;
  space_name: string | null;
  scope: "zone" | "open";
  note: string | null;
  status: string;
  taken_by: string | null;
  created_at: string;
  is_mine: boolean;
}
export const useAvailabilityFeed = () => {
  const { user } = useAuth();
  const { ratingSport } = useActiveSport();
  return useQuery<FeedCall[]>({
    queryKey: ["availability-feed", ratingSport, user?.id],
    enabled: !!user,
    refetchInterval: 20_000, // feed "en vivo": refresca solo cada 20s
    queryFn: async () => {
      const { data, error } = await supabase.rpc("availability_feed", { _sport: ratingSport });
      if (error) throw error;
      return (data as FeedCall[] | null) ?? [];
    },
  });
};

// ── Publicar disponibilidad (post_availability → availability_calls 'open') ────
export const usePostAvailability = () => {
  const refresh = useCanchaRefresh();
  return useMutation({
    mutationFn: async (vars: { sport: string; slots: string[]; spaceId: string | null; scope: "zone" | "open"; note?: string }) => {
      const { data, error } = await supabase.rpc("post_availability", {
        _sport: vars.sport,
        _slots: vars.slots,
        _space_id: vars.spaceId,
        _scope: vars.scope,
        _note: vars.note ?? null,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      refresh();
      toast.success("¡Llamado publicado! Lo ve toda tu Zona.");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "No se pudo publicar el llamado"),
  });
};

// ── Retirar un llamado propio (status='expired'; RLS permite solo el propio) ───
export const useWithdrawAvailability = () => {
  const refresh = useCanchaRefresh();
  return useMutation({
    mutationFn: async (callId: string) => {
      const { error } = await supabase.from("availability_calls").update({ status: "expired" }).eq("id", callId);
      if (error) throw error;
    },
    onSuccess: () => {
      refresh();
      toast.success("Llamado retirado");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "No se pudo retirar"),
  });
};

export const useRespondChallenge = () => {
  const refresh = useCanchaRefresh();
  return useMutation({
    mutationFn: async (vars: { id: string; action: "accept" | "reject" | "propose"; slot?: string; slots?: string[] }) => {
      const { error } = await supabase.rpc("respond_challenge", {
        _challenge_id: vars.id,
        _action: vars.action,
        _slot: vars.slot ?? null,
        _slots: vars.slots ?? null,
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

// ── Perfil público (get_public_profile · privacidad + is_minor mandan, Addendum D) ─
export interface PublicProfile {
  user_id: string;
  name: string | null;
  avatar_url: string | null;
  avatar_kind: string | null;
  avatar_look: string | null;
  is_minor: boolean;
  nivel: number | null;
  category: string | null;
  matches_played: number | null;
  show_record: boolean;
  show_ranking: boolean;
  show_streak: boolean;
  show_spaces: boolean;
  show_head_to_head: boolean;
  h2h_wins: number | null;
  h2h_losses: number | null;
}
export const usePublicProfile = (id: string | undefined) => {
  const { user } = useAuth();
  const { ratingSport } = useActiveSport();
  return useQuery<PublicProfile | null>({
    queryKey: ["public-profile", id, ratingSport, user?.id],
    enabled: !!user && !!id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_public_profile", { _user_id: id, _sport: ratingSport });
      if (error) throw error;
      return (data as PublicProfile[] | null)?.[0] ?? null;
    },
  });
};

// ── Mis espacios activos (para el "Lugar" del reto: club/escalerilla en común) ──
export interface MySpace {
  id: string;
  name: string | null;
  type: string;
}
export const useMySpaces = () => {
  const { user } = useAuth();
  return useQuery<MySpace[]>({
    queryKey: ["my-spaces", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("space_membership")
        .select("space:space!space_membership_space_id_fkey(id, name, type)")
        .eq("player_id", user!.id)
        .eq("status", "active");
      if (error) throw error;
      const rows = (data as unknown as { space: MySpace | null }[]) ?? [];
      return rows
        .map((r) => r.space)
        .filter((s): s is MySpace => !!s && (s.type === "club" || s.type === "escalerilla"));
    },
  });
};

// ── Enviar reto (send_challenge → challenges 'pending'; no premia nada) ────────
export const useSendChallenge = () => {
  const refresh = useCanchaRefresh();
  return useMutation({
    mutationFn: async (vars: { to: string; spaceId: string | null; slots: string[]; sport: string; note?: string }) => {
      const { data, error } = await supabase.rpc("send_challenge", {
        _to: vars.to,
        _space_id: vars.spaceId,
        _slots: vars.slots,
        _sport: vars.sport,
        _note: vars.note ?? null,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      refresh();
      toast.success("Reto enviado · queda pendiente de su respuesta");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "No se pudo enviar el reto"),
  });
};

// ── Retos enviados (para la bandeja /invitaciones · pestaña Enviadas) ─────────
export interface SentChallenge {
  id: string;
  sport: string;
  proposed_slots: string[];
  agreed_slot: string | null;
  status: string;
  note: string | null;
  match_id: string | null;
  created_at: string;
  to_profile: ProfileMini | null;
  space: { name: string | null } | null;
}
export const useSentChallenges = () => {
  const { user } = useAuth();
  return useQuery<SentChallenge[]>({
    queryKey: ["sent-challenges", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("challenges")
        .select(
          "id, sport, proposed_slots, agreed_slot, status, note, match_id, created_at, " +
            "to_profile:profiles!challenges_to_user_fkey(id, display_name, avatar_url, avatar_kind, avatar_look), " +
            "space:space!challenges_space_id_fkey(name)",
        )
        .eq("from_user", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as unknown as SentChallenge[]) ?? [];
    },
  });
};

// ── Un reto puntual (para la pantalla de cargar resultado) ────────────────────
export interface ChallengeDetail {
  id: string;
  from_user: string;
  to_user: string;
  sport: string;
  space_id: string | null;
  agreed_slot: string | null;
  status: string;
  match_id: string | null;
  from_profile: ProfileMini | null;
  to_profile: ProfileMini | null;
  space: { name: string | null } | null;
}
export const useChallenge = (id: string | undefined) => {
  const { user } = useAuth();
  return useQuery<ChallengeDetail | null>({
    queryKey: ["challenge", id, user?.id],
    enabled: !!user && !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("challenges")
        .select(
          "id, from_user, to_user, sport, space_id, agreed_slot, status, match_id, " +
            "from_profile:profiles!challenges_from_user_fkey(id, display_name, avatar_url, avatar_kind, avatar_look), " +
            "to_profile:profiles!challenges_to_user_fkey(id, display_name, avatar_url, avatar_kind, avatar_look), " +
            "space:space!challenges_space_id_fkey(name)",
        )
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as ChallengeDetail) ?? null;
    },
  });
};

// ── Cargar resultado de un reto: materializa el partido con el MOTOR existente de
//    resultados (vía record_challenge_result) y enlaza challenge.match_id. El rating
//    se mueve después, al confirmar (doble confirmación del motor). ───────────────
export const useRecordChallengeResult = () => {
  const refresh = useCanchaRefresh();
  return useMutation({
    mutationFn: async (vars: { challengeId: string; winnerIsMe: boolean; sets: { a: number; b: number }[] }) => {
      const { data, error } = await supabase.rpc("record_challenge_result", {
        _challenge_id: vars.challengeId,
        _winner_is_me: vars.winnerIsMe,
        _sets: vars.sets.map((s) => ({ games_a: s.a, games_b: s.b })),
      });
      if (error) throw error;
      return data as string; // match id
    },
    onSuccess: () => {
      refresh();
      toast.success("Resultado cargado · espera la confirmación de tu rival");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "No se pudo cargar el resultado"),
  });
};

// ── Datos del badge de victoria (match_victory_card · solo lectura) ────────────
export interface VictoryCard {
  opponent_id: string;
  opponent_name: string | null;
  opponent_avatar_url: string | null;
  opponent_avatar_kind: string | null;
  opponent_avatar_look: string | null;
  i_won: boolean;
  confirmed: boolean;
  sets: { me: number; opp: number }[];
  pts_delta: number | null;
  xp_delta: number | null;
  space_name: string | null;
  club_name: string | null;
}
export const useVictoryCard = (matchId: string | undefined) => {
  const { user } = useAuth();
  return useQuery<VictoryCard | null>({
    queryKey: ["victory-card", matchId, user?.id],
    enabled: !!user && !!matchId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("match_victory_card", { _match_id: matchId });
      if (error) throw error;
      return (data as VictoryCard[] | null)?.[0] ?? null;
    },
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
