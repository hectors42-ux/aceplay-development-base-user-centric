import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import { useBookingsProvider } from "@/hooks/useBookingsProvider";


export type NotificationKind =
  | "club_announcement"
  | "result_proposal"
  | "result_to_load"
  | "reschedule_request"
  | "doubles_invitation"
  | "admin_registration"
  | "ladder_challenge"
  | "ladder_challenge_accepted"
  | "ladder_propose_slots"
  | "ladder_slots_proposed"
  | "ladder_result_pending"
  | "ladder_result"
  | "challenge_expired"
  | "booking_partner"
  | "match_acceptance"
  | "class_invitation"
  | "partner_invitation"
  | "partner_invitation_received"
  | "partner_invitation_accepted"
  | "partner_invitation_rejected"
  | "partner_match_booked"
  | "partner_match_cancelled"
  | "partner_match_reminder"
  | "tournament_match_scheduled"
  | "tournament_streak"
  | "tournament_champion";

export interface NotificationItem {
  kind: NotificationKind;
  ref_id: string;
  title: string;
  description: string;
  link: string;
  created_at: string;
}

/**
 * Feed unificado de acciones pendientes (torneos + ladder).
 * Refresca cada 90s y al recibir cambios en las tablas relevantes.
 */
export function useNotificationsFeed() {
  const { user } = useAuth();
  const { isExternal } = useBookingsProvider();
  const [items, setItems] = useState<NotificationItem[]>([]);

  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setItems([]);
      return;
    }
    setLoading(true);
    const [feedRes, signalsRes, dismissalsRes] = await Promise.all([
      supabase.rpc("notifications_feed"),
      // PRD 7 · señales del torneo (racha, campeón)
      (supabase.rpc as unknown as (fn: string) => Promise<{ data: NotificationItem[] | null; error: unknown }>)(
        "tournament_signals_feed",
      ),
      supabase
        .from("notification_dismissals")
        .select("kind, ref_id")
        .eq("user_id", user.id),
    ]);
    setLoading(false);
    if (feedRes.error) {
      console.warn("[notifications-feed] failed", feedRes.error);
      return;
    }
    if (signalsRes.error) {
      console.warn("[notifications-feed] signals failed", signalsRes.error);
    }
    const dismissed = new Set(
      (dismissalsRes.data ?? []).map((d) => `${d.kind}::${d.ref_id}`),
    );
    const BOOKING_KINDS = new Set<NotificationKind>([
      "booking_partner",
      "partner_match_booked",
      "partner_match_cancelled",
      "partner_match_reminder",
    ]);
    const combined = [
      ...((feedRes.data ?? []) as NotificationItem[]),
      ...((signalsRes.data ?? []) as NotificationItem[]),
    ];
    const list = combined.filter(
      (n) => !dismissed.has(`${n.kind}::${n.ref_id}`) && !(isExternal && BOOKING_KINDS.has(n.kind)),
    );

    list.sort((a, b) => {
      // Anuncios del club siempre arriba; dentro de cada grupo, más recientes primero.
      const aAnn = a.kind === "club_announcement" ? 0 : 1;
      const bAnn = b.kind === "club_announcement" ? 0 : 1;
      if (aAnn !== bAnn) return aAnn - bAnn;
      return (b.created_at ?? "").localeCompare(a.created_at ?? "");
    });
    setItems(list);
  }, [user, isExternal]);


  useEffect(() => {
    void refresh();
    if (!user) return;

    const interval = setInterval(() => void refresh(), 90_000);

    const channel = supabase
      .channel(`notifications-feed-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tournament_match_results" },
        () => void refresh(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tournament_match_reschedule_requests" },
        () => void refresh(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tournament_registrations" },
        () => void refresh(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ladder_challenges" },
        () => void refresh(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ladder_challenge_schedule_proposals" },
        () => void refresh(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tournament_matches" },
        () => void refresh(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings" },
        () => void refresh(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "coach_class_bookings" },
        () => void refresh(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_notifications", filter: `user_id=eq.${user.id}` },
        () => void refresh(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "match_invitations" },
        () => void refresh(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "club_announcements" },
        () => void refresh(),
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [user, refresh]);

  return { items, loading, refresh, total: items.length };
}
