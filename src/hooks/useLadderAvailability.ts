import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays, addMinutes, isBefore, startOfDay } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { generateSlots, type CourtLite } from "@/lib/booking-utils";

export interface DaySlot {
  startsAt: Date;
  availableCount: number; // canchas libres a esa hora (90 min)
}

export interface DayBucket {
  date: Date;
  slots: DaySlot[];
  totalAvailable: number;
}

interface Params {
  tenantId: string | null | undefined;
  surface: string | null | undefined;
  windowDays: number;
  durationMin?: number; // default 90
  enabled?: boolean;
}

/**
 * Devuelve, por día (desde mañana hasta windowDays), los slots reales del club
 * para canchas con la superficie indicada, y cuántas canchas libres hay en cada hora.
 */
export const useLadderAvailability = ({
  tenantId,
  surface,
  windowDays,
  durationMin = 90,
  enabled = true,
}: Params) => {
  const qc = useQueryClient();
  const queryKey = ["ladder-availability", tenantId, surface, windowDays, durationMin];

  useEffect(() => {
    if (!tenantId || !enabled) return;
    const ch = supabase
      .channel(`ladder-availability-${tenantId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings", filter: `tenant_id=eq.${tenantId}` },
        () => qc.invalidateQueries({ queryKey: ["ladder-availability", tenantId] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "coach_class_bookings", filter: `tenant_id=eq.${tenantId}` },
        () => qc.invalidateQueries({ queryKey: ["ladder-availability", tenantId] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [tenantId, enabled, qc]);

  return useQuery({
    queryKey,
    enabled: !!tenantId && !!surface && enabled,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<DayBucket[]> => {
      const fromIso = startOfDay(new Date()).toISOString();
      const toIso = addDays(startOfDay(new Date()), windowDays + 1).toISOString();

      const [{ data: courts }, { data: bookings }, { data: classes }] = await Promise.all([
        supabase
          .from("courts")
          .select("*")
          .eq("tenant_id", tenantId!)
          .eq("surface", surface as "arcilla" | "cesped" | "dura" | "sintetico")
          .eq("is_active", true)
          .order("sort_order", { ascending: true }),
        supabase
          .from("bookings")
          .select("court_id, starts_at, ends_at, status")
          .eq("tenant_id", tenantId!)
          .gte("starts_at", fromIso)
          .lte("starts_at", toIso)
          .neq("status", "cancelada"),
        supabase
          .from("coach_class_bookings")
          .select("court_id, starts_at, ends_at, status")
          .eq("tenant_id", tenantId!)
          .gte("starts_at", fromIso)
          .lte("starts_at", toIso),
      ]);

      const activeCourts = (courts ?? []) as CourtLite[];
      if (activeCourts.length === 0) return [];

      const buckets: DayBucket[] = [];
      const now = new Date();
      // Empezar mañana
      for (let d = 1; d <= windowDays; d++) {
        const day = addDays(startOfDay(now), d);
        // Generar set de horas posibles uniendo todas las canchas
        const hourMap = new Map<number, Set<string>>(); // ts -> courts disponibles
        for (const court of activeCourts) {
          const slots = generateSlots(court, day);
          for (const slot of slots) {
            // requiere que slot+90min no exceda closes_at
            const [ch, cm] = court.closes_at.split(":").map(Number);
            const closes = new Date(day);
            closes.setHours(ch, cm, 0, 0);
            if (addMinutes(slot, durationMin) > closes) continue;
            if (isBefore(addMinutes(slot, durationMin), addMinutes(now, 60))) continue;
            const ts = slot.getTime();
            if (!hourMap.has(ts)) hourMap.set(ts, new Set());
            // contar libre solo si no hay solape
            const slotEnd = addMinutes(slot, durationMin);
            const courtBusy =
              (bookings ?? []).some(
                (b) =>
                  b.court_id === court.id &&
                  new Date(b.starts_at) < slotEnd &&
                  new Date(b.ends_at) > slot,
              ) ||
              (classes ?? []).some(
                (c) =>
                  c.court_id === court.id &&
                  c.status !== "cancelada" &&
                  new Date(c.starts_at) < slotEnd &&
                  new Date(c.ends_at) > slot,
              );
            if (!courtBusy) hourMap.get(ts)!.add(court.id);
          }
        }
        const slotsArr: DaySlot[] = Array.from(hourMap.entries())
          .map(([ts, set]) => ({ startsAt: new Date(ts), availableCount: set.size }))
          .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
        buckets.push({
          date: day,
          slots: slotsArr,
          totalAvailable: slotsArr.reduce((acc, s) => acc + (s.availableCount > 0 ? 1 : 0), 0),
        });
      }
      return buckets;
    },
  });
};
