import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Court = { id: string; name: string; sort_order: number };
type Booking = { court_id: string; starts_at: string; ends_at: string; block_reason: string | null };

interface Props {
  tenantId: string;
  sessionId: string;
  startsAt: string;
  endsAt: string;
  selectedCourts: string[];
  onChange: (courtIds: string[]) => void;
  readOnly?: boolean;
}

/** Genera franjas de 1h dentro del rango. */
const buildSlots = (startsAt: string, endsAt: string) => {
  const out: { from: Date; to: Date; label: string }[] = [];
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  start.setMinutes(0, 0, 0);
  let cursor = new Date(start);
  while (cursor < end) {
    const to = new Date(cursor);
    to.setHours(to.getHours() + 1);
    out.push({
      from: new Date(cursor),
      to,
      label: cursor.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", hour12: false }),
    });
    cursor = to;
  }
  return out;
};

export const CourtBookingGrid = ({
  tenantId,
  sessionId,
  startsAt,
  endsAt,
  selectedCourts,
  onChange,
  readOnly,
}: Props) => {
  const [courts, setCourts] = useState<Court[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const slots = useMemo(() => buildSlots(startsAt, endsAt), [startsAt, endsAt]);
  const dragStart = useRef<{ courtIdx: number; slotIdx: number } | null>(null);
  const [hover, setHover] = useState<{ courtIdx: number; slotIdx: number } | null>(null);
  const [previewSelection, setPreviewSelection] = useState<Set<string> | null>(null);

  useEffect(() => {
    (async () => {
      const [c, b] = await Promise.all([
        supabase
          .from("courts")
          .select("id,name,sort_order")
          .eq("tenant_id", tenantId)
          .eq("is_active", true)
          .order("sort_order"),
        supabase
          .from("bookings")
          .select("court_id,starts_at,ends_at,block_reason")
          .eq("tenant_id", tenantId)
          .lt("starts_at", endsAt)
          .gt("ends_at", startsAt)
          .eq("status", "confirmada"),
      ]);
      setCourts((c.data as Court[] | null) ?? []);
      setBookings((b.data as Booking[] | null) ?? []);
    })();
  }, [tenantId, startsAt, endsAt, sessionId]);

  const isBlockedByOther = (courtId: string, from: Date, to: Date) =>
    bookings.some(
      (bk) =>
        bk.court_id === courtId &&
        bk.block_reason !== sessionId &&
        new Date(bk.starts_at) < to &&
        new Date(bk.ends_at) > from,
    );

  const computeRect = (a: { courtIdx: number; slotIdx: number }, b: { courtIdx: number; slotIdx: number }) => {
    const r1 = Math.min(a.courtIdx, b.courtIdx);
    const r2 = Math.max(a.courtIdx, b.courtIdx);
    const c1 = Math.min(a.slotIdx, b.slotIdx);
    const c2 = Math.max(a.slotIdx, b.slotIdx);
    const set = new Set<string>();
    for (let i = r1; i <= r2; i++) {
      const court = courts[i];
      if (!court) continue;
      for (let j = c1; j <= c2; j++) {
        if (!isBlockedByOther(court.id, slots[j].from, slots[j].to)) {
          set.add(court.id);
        }
      }
    }
    return set;
  };

  const handleDown = (courtIdx: number, slotIdx: number) => {
    if (readOnly) return;
    dragStart.current = { courtIdx, slotIdx };
    setHover({ courtIdx, slotIdx });
    setPreviewSelection(computeRect({ courtIdx, slotIdx }, { courtIdx, slotIdx }));
  };

  const handleMove = (courtIdx: number, slotIdx: number) => {
    if (readOnly || !dragStart.current) return;
    setHover({ courtIdx, slotIdx });
    setPreviewSelection(computeRect(dragStart.current, { courtIdx, slotIdx }));
  };

  const handleUp = () => {
    if (readOnly || !dragStart.current || !hover) return;
    const rect = computeRect(dragStart.current, hover);
    const next = new Set(selectedCourts);
    // Toggle: si TODOS los del rect ya están seleccionados → deselecciona; si no, agrega.
    const allSelected = Array.from(rect).every((id) => next.has(id));
    rect.forEach((id) => {
      if (allSelected) next.delete(id);
      else next.add(id);
    });
    onChange(Array.from(next));
    dragStart.current = null;
    setHover(null);
    setPreviewSelection(null);
  };

  return (
    <div
      className="overflow-x-auto rounded-2xl border border-border bg-card"
      onMouseUp={handleUp}
      onMouseLeave={handleUp}
      onTouchEnd={handleUp}
    >
      <table className="w-full min-w-[480px] border-collapse text-[11px]">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-card px-2 py-2 text-left font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Cancha
            </th>
            {slots.map((s, j) => (
              <th
                key={j}
                className="px-1 py-2 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground"
              >
                {s.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {courts.map((court, i) => (
            <tr key={court.id} className="border-t border-border">
              <td className="sticky left-0 z-10 bg-card px-2 py-1 text-left font-medium">
                {court.name}
              </td>
              {slots.map((s, j) => {
                const blocked = isBlockedByOther(court.id, s.from, s.to);
                const isSelected = selectedCourts.includes(court.id);
                const inPreview = previewSelection?.has(court.id) ?? false;
                let cls = "border border-border/40 ";
                if (blocked) cls += "bg-muted text-muted-foreground/50 cursor-not-allowed";
                else if (inPreview) cls += "bg-primary/40 cursor-pointer";
                else if (isSelected) cls += "bg-primary/80 text-primary-foreground cursor-pointer";
                else cls += "bg-background hover:bg-muted/50 cursor-pointer";
                return (
                  <td
                    key={j}
                    aria-disabled={blocked}
                    className={`h-9 min-w-[44px] select-none text-center ${cls}`}
                    onMouseDown={() => !blocked && handleDown(i, j)}
                    onMouseEnter={() => !blocked && handleMove(i, j)}
                    onTouchStart={() => !blocked && handleDown(i, j)}
                  />
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {courts.length === 0 && (
        <p className="px-4 py-6 text-center text-xs text-muted-foreground">
          Sin canchas activas. Configúralas en Admin → Canchas.
        </p>
      )}
    </div>
  );
};