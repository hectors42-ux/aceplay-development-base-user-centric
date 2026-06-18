import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import {
  startSpan,
  mark,
  markOldestOpen,
  endOldestOpen,
} from "@/lib/notifications-telemetry";

export interface TournamentPendingCounts {
  result_proposals: number;
  reschedule_requests: number;
  doubles_invitations: number;
  admin_pending_registrations: number;
  total: number;
}

const EMPTY: TournamentPendingCounts = {
  result_proposals: 0,
  reschedule_requests: 0,
  doubles_invitations: 0,
  admin_pending_registrations: 0,
  total: 0,
};

/**
 * Devuelve los conteos de acciones pendientes (resultados a confirmar,
 * reagendamientos, invitaciones de dobles, e inscripciones pendientes
 * para admins). Refresca cada 60s y al recibir cambios realtime sobre
 * las tablas relevantes.
 */
export function useTournamentNotifications() {
  const { user } = useAuth();
  const [counts, setCounts] = useState<TournamentPendingCounts>(EMPTY);
  const [loading, setLoading] = useState(false);
  const initializedRef = useRef(false);

  const refresh = useCallback(async (spanId?: string) => {
    if (!user) {
      setCounts(EMPTY);
      return;
    }
    setLoading(true);
    if (spanId) mark(spanId, "refresh-start");
    else markOldestOpen("tournament", "refresh-start");
    const { data, error } = await supabase.rpc("tournament_pending_counts");
    if (spanId) mark(spanId, "refresh-end");
    else markOldestOpen("tournament", "refresh-end");
    setLoading(false);
    if (error) {
      console.warn("[notifications] failed to fetch counts", error);
      return;
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (row) {
      setCounts({
        result_proposals: row.result_proposals ?? 0,
        reschedule_requests: row.reschedule_requests ?? 0,
        doubles_invitations: row.doubles_invitations ?? 0,
        admin_pending_registrations: row.admin_pending_registrations ?? 0,
        total: row.total ?? 0,
      });
      initializedRef.current = true;
    }
  }, [user]);

  // Cierra el span cuando el contador rerenderiza
  useEffect(() => {
    if (!initializedRef.current) return;
    markOldestOpen("tournament", "counter-updated");
    endOldestOpen("tournament");
  }, [counts.total]);

  useEffect(() => {
    refresh();
    if (!user) return;

    // Polling base cada 60s; si Realtime falla, baja a 5s como fallback.
    let pollMs = 60_000;
    let interval = setInterval(() => void refresh(), pollMs);

    const enableFastPolling = (reason: string) => {
      if (pollMs === 5_000) return;
      console.warn(`[notifications] realtime fallback → polling 5s (${reason})`);
      pollMs = 5_000;
      clearInterval(interval);
      interval = setInterval(() => void refresh(), pollMs);
      void refresh();
    };

    let confirmed = false;
    const subscribeTimeout = setTimeout(() => {
      if (!confirmed) enableFastPolling("subscribe timeout");
    }, 5_000);

    const onChange = (table: string) => (payload: unknown) => {
      const spanId = startSpan("tournament", {
        table,
        eventType: (payload as { eventType?: string })?.eventType,
      });
      void refresh(spanId);
    };

    // Realtime: cuando cambian las tablas relevantes, refrescar
    const channel = supabase
      .channel(`tournament-notifications-${user.id}-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tournament_match_results" },
        onChange("tournament_match_results"),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tournament_match_reschedule_requests" },
        onChange("tournament_match_reschedule_requests"),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tournament_registrations" },
        onChange("tournament_registrations"),
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          confirmed = true;
        } else if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT" ||
          status === "CLOSED"
        ) {
          enableFastPolling(status);
        }
      });

    return () => {
      clearTimeout(subscribeTimeout);
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [user, refresh]);

  return { counts, loading, refresh };
}
