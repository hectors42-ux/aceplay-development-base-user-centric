import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import { toast } from "@/hooks/use-toast";
import {
  startSpan,
  mark,
  endSpan,
  markOldestOpen,
  endOldestOpen,
} from "@/lib/notifications-telemetry";

export interface LadderPendingCounts {
  challenges_received: number;
  results_to_confirm: number;
  scheduled_matches: number;
  expiring_soon: number;
  total: number;
}

const EMPTY: LadderPendingCounts = {
  challenges_received: 0,
  results_to_confirm: 0,
  scheduled_matches: 0,
  expiring_soon: 0,
  total: 0,
};

/**
 * Conteos de acciones pendientes de ladder para el usuario actual.
 * Refresca cada 60s, ante cambios realtime en `ladder_challenges`,
 * y emite toasts cuando llega un nuevo desafío o un resultado por confirmar.
 */
export function useLadderNotifications() {
  const { user } = useAuth();
  const [counts, setCounts] = useState<LadderPendingCounts>(EMPTY);
  const [loading, setLoading] = useState(false);
  const prevRef = useRef<LadderPendingCounts>(EMPTY);
  const initializedRef = useRef(false);
  const lastTotalRef = useRef<number>(0);

  const refresh = useCallback(async (spanId?: string) => {
    if (!user) {
      setCounts(EMPTY);
      prevRef.current = EMPTY;
      return;
    }
    setLoading(true);
    if (spanId) mark(spanId, "refresh-start");
    else markOldestOpen("ladder", "refresh-start");
    const { data, error } = await supabase.rpc("ladder_pending_counts");
    if (spanId) mark(spanId, "refresh-end");
    else markOldestOpen("ladder", "refresh-end");
    setLoading(false);
    if (error) {
      console.warn("[ladder-notifications] failed to fetch counts", error);
      return;
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return;
    const next: LadderPendingCounts = {
      challenges_received: row.challenges_received ?? 0,
      results_to_confirm: row.results_to_confirm ?? 0,
      scheduled_matches: row.scheduled_matches ?? 0,
      expiring_soon: row.expiring_soon ?? 0,
      total: row.total ?? 0,
    };

    // Toasts solo cuando ya hubo una primera carga y aumenta el conteo
    if (initializedRef.current) {
      const prev = prevRef.current;
      if (next.challenges_received > prev.challenges_received) {
        markOldestOpen("ladder", "toast-shown");
        toast({
          title: "Nuevo desafío en la Pirámide",
          description: "Un jugador te ha desafiado. Responde antes de que expire.",
        });
      }
      if (next.results_to_confirm > prev.results_to_confirm) {
        markOldestOpen("ladder", "toast-shown");
        toast({
          title: "Resultado por confirmar",
          description: "Tu rival propuso un resultado. Revísalo y confírmalo.",
        });
      }
    }
    prevRef.current = next;
    initializedRef.current = true;
    lastTotalRef.current = next.total;
    setCounts(next);
  }, [user]);

  // Cuando el total visible cambia, anota el hito "counter-updated" y cierra el span
  useEffect(() => {
    if (!initializedRef.current) return;
    markOldestOpen("ladder", "counter-updated");
    endOldestOpen("ladder");
  }, [counts.total]);

  useEffect(() => {
    void refresh();
    if (!user) return;

    // Polling base cada 60s; si Realtime falla, baja a 5s como fallback.
    let pollMs = 60_000;
    let interval = setInterval(() => void refresh(), pollMs);

    const enableFastPolling = (reason: string) => {
      if (pollMs === 5_000) return;
      console.warn(`[ladder-notifications] realtime fallback → polling 5s (${reason})`);
      pollMs = 5_000;
      clearInterval(interval);
      interval = setInterval(() => void refresh(), pollMs);
      // Refresh inmediato para no esperar al primer tick.
      void refresh();
    };

    let confirmed = false;
    const subscribeTimeout = setTimeout(() => {
      if (!confirmed) enableFastPolling("subscribe timeout");
    }, 5_000);

    const channel = supabase
      .channel(`ladder-notifications-${user.id}-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ladder_challenges" },
        (payload) => {
          const spanId = startSpan("ladder", {
            table: "ladder_challenges",
            eventType: (payload as { eventType?: string })?.eventType,
          });
          void refresh(spanId);
        },
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
      void supabase.removeChannel(channel);
    };
  }, [user, refresh]);

  return { counts, loading, refresh };
}
