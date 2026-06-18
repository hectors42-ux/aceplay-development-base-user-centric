import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import { recordInvitationsPerf } from "@/lib/invitations-perf";

export interface MatchInvitation {
  id: string;
  inviter_user_id: string;
  invitee_user_id: string;
  status: "pending" | "accepted" | "rejected" | "expired" | "cancelled";
  proposed_slots: Array<{ starts_at: string; court_id?: string | null }>;
  selected_slot: { starts_at: string; court_id?: string | null } | null;
  message: string | null;
  compat_score: number | null;
  expires_at: string;
  responded_at: string | null;
  created_at: string;
}

export interface InvitationWithProfile extends MatchInvitation {
  counterpart: {
    user_id: string;
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
  } | null;
}

type RefreshOrigin = "initial" | "manual" | "realtime";

export const useMatchInvitations = () => {
  const { user } = useAuth();
  const [received, setReceived] = useState<InvitationWithProfile[]>([]);
  const [sent, setSent] = useState<InvitationWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const didInitialLoad = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Marca cuándo llegó el primer evento realtime del lote (para medir latencia real percibida).
  const realtimeStartRef = useRef<number | null>(null);

  const refresh = useCallback(
    async (origin: RefreshOrigin = "manual") => {
      if (!user) return;
      const t0 = performance.now();
      if (!didInitialLoad.current) setLoading(true);

      const tInv0 = performance.now();
      const { data } = await supabase
        .from("match_invitations")
        .select("*")
        .or(`inviter_user_id.eq.${user.id},invitee_user_id.eq.${user.id}`)
        .order("created_at", { ascending: false });
      const invitationsMs = performance.now() - tInv0;

      const invitations = (data ?? []) as unknown as MatchInvitation[];
      const counterpartIds = Array.from(
        new Set(
          invitations.map((i) =>
            i.inviter_user_id === user.id ? i.invitee_user_id : i.inviter_user_id,
          ),
        ),
      );

      const profiles: Record<string, InvitationWithProfile["counterpart"]> = {};
      const tProf0 = performance.now();
      if (counterpartIds.length > 0) {
        const { data: prof } = await supabase
          .from("profiles_directory")
          .select("user_id, first_name, last_name, avatar_url")
          .in("user_id", counterpartIds);
        (prof ?? []).forEach((p) => {
          profiles[p.user_id] = p;
        });
      }
      const profilesMs = performance.now() - tProf0;

      const enriched: InvitationWithProfile[] = invitations.map((i) => ({
        ...i,
        counterpart:
          profiles[i.inviter_user_id === user.id ? i.invitee_user_id : i.inviter_user_id] ?? null,
      }));

      setReceived(enriched.filter((i) => i.invitee_user_id === user.id));
      setSent(enriched.filter((i) => i.inviter_user_id === user.id));

      const wasInitial = !didInitialLoad.current;
      didInitialLoad.current = true;
      setLoading(false);

      const effectiveOrigin: RefreshOrigin = wasInitial ? "initial" : origin;
      const realtimeLatencyMs =
        effectiveOrigin === "realtime" && realtimeStartRef.current !== null
          ? performance.now() - realtimeStartRef.current
          : undefined;
      if (effectiveOrigin === "realtime") realtimeStartRef.current = null;

      recordInvitationsPerf({
        origin: effectiveOrigin,
        ms: performance.now() - t0,
        invitationsMs,
        profilesMs,
        count: invitations.length,
        realtimeLatencyMs,
        at: Date.now(),
      });
    },
    [user],
  );

  // Refresh con debounce, para coalescer ráfagas de eventos realtime.
  const debouncedRefresh = useCallback(() => {
    if (realtimeStartRef.current === null) realtimeStartRef.current = performance.now();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void refresh("realtime");
    }, 250);
  }, [refresh]);

  useEffect(() => {
    void refresh("initial");
  }, [refresh]);

  // Realtime: dos canales filtrados por servidor (más barato que escuchar todo).
  useEffect(() => {
    if (!user) return;
    // Topic único por mount para evitar reusar un canal ya suscrito
    // (StrictMode/HMR provoca "cannot add postgres_changes callbacks after subscribe()").
    const uniq = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const chReceived = supabase
      .channel(`mi_recv_${user.id}_${uniq}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "match_invitations",
          filter: `invitee_user_id=eq.${user.id}`,
        },
        () => debouncedRefresh(),
      )
      .subscribe();
    const chSent = supabase
      .channel(`mi_sent_${user.id}_${uniq}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "match_invitations",
          filter: `inviter_user_id=eq.${user.id}`,
        },
        () => debouncedRefresh(),
      )
      .subscribe();
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(chReceived);
      supabase.removeChannel(chSent);
    };
  }, [user, debouncedRefresh]);

  return { received, sent, loading, refresh: () => refresh("manual") };
};
