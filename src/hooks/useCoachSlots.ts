import { useQuery } from "@tanstack/react-query";
import { addDays, startOfDay, isBefore, isAfter } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import { useClassBlocks, useCoachUpcomingClasses } from "@/hooks/useCoachClasses";

export interface SlotOption {
  startsAt: Date;
  endsAt: Date;
  courtId: string;
  courtName: string;
  durationMin: number;
}

interface Params {
  coachId: string | null | undefined;
  duration: number;
  days?: number;
  externalOnly?: boolean;
  enabled?: boolean;
  /** Filtra canchas por deporte (tenis | padel). Si se omite, no filtra. */
  sport?: "tenis" | "padel";
}


/** Calcula los slots disponibles para un coach: bloques × canchas − bookings − clases existentes. */
export const useCoachSlots = ({
  coachId,
  duration,
  days = 7,
  externalOnly = false,
  enabled = true,
  sport,
}: Params) => {
  const { profile } = useAuth();
  const tenantId = profile?.tenant_id;

  const { data: blocks = [] } = useClassBlocks(coachId);
  const { data: existing = [] } = useCoachUpcomingClasses(coachId);

  const courtsQ = useQuery({
    queryKey: ["courts-active", tenantId, sport ?? "all"],
    enabled: !!tenantId && enabled,
    queryFn: async () => {
      let q = supabase
        .from("courts")
        .select("id, name, sport")
        .eq("tenant_id", tenantId!)
        .eq("is_active", true);
      if (sport) q = q.eq("sport", sport);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });


  const bookingsQ = useQuery({
    queryKey: ["bookings-near", tenantId, days],
    enabled: !!tenantId && enabled,
    queryFn: async () => {
      const fromIso = startOfDay(new Date()).toISOString();
      const toIso = addDays(startOfDay(new Date()), days + 1).toISOString();
      const { data, error } = await supabase
        .from("bookings")
        .select("court_id, starts_at, ends_at, status")
        .eq("tenant_id", tenantId!)
        .gte("starts_at", fromIso)
        .lte("starts_at", toIso)
        .neq("status", "cancelada");
      if (error) throw error;
      return data ?? [];
    },
  });

  const courts = courtsQ.data ?? [];
  const bookings = bookingsQ.data ?? [];

  const slots: SlotOption[] = (() => {
    if (!coachId || !blocks.length || !courts.length) return [];
    const out: SlotOption[] = [];
    const now = new Date();
    for (let d = 0; d < days; d++) {
      const day = addDays(startOfDay(now), d);
      const weekday = day.getDay();
      const dayBlocks = blocks.filter((b) => b.weekday === weekday);
      for (const block of dayBlocks) {
        if (externalOnly && !block.allow_external) continue;
        const court = courts.find((c) => c.id === block.court_id);
        if (!court) continue;
        const [bh, bm] = block.starts_at.split(":").map(Number);
        const [eh, em] = block.ends_at.split(":").map(Number);
        const blockStart = new Date(day);
        blockStart.setHours(bh, bm, 0, 0);
        const blockEnd = new Date(day);
        blockEnd.setHours(eh, em, 0, 0);
        for (
          let t = new Date(blockStart);
          t.getTime() + duration * 60_000 <= blockEnd.getTime();
          t = new Date(t.getTime() + 30 * 60_000)
        ) {
          const slotStart = new Date(t);
          const slotEnd = new Date(t.getTime() + duration * 60_000);
          if (isBefore(slotStart, now)) continue;
          const courtBusy = bookings.some(
            (b) =>
              b.court_id === court.id &&
              isBefore(new Date(b.starts_at), slotEnd) &&
              isAfter(new Date(b.ends_at), slotStart),
          );
          if (courtBusy) continue;
          const coachBusy = existing.some(
            (c) =>
              isBefore(new Date(c.starts_at), slotEnd) &&
              isAfter(new Date(c.ends_at), slotStart),
          );
          if (coachBusy) continue;
          out.push({
            startsAt: slotStart,
            endsAt: slotEnd,
            courtId: court.id,
            courtName: court.name,
            durationMin: duration,
          });
        }
      }
    }
    return out.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  })();

  return {
    slots,
    isLoading: courtsQ.isLoading || bookingsQ.isLoading,
    courts,
  };
};
