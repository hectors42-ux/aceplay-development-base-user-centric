import { addMinutes, format, isBefore, isSameDay, parseISO, set, startOfDay } from "date-fns";

export interface CourtLite {
  id: string;
  name: string;
  surface: string;
  slot_minutes: number;
  opens_at: string; // "HH:MM:SS"
  closes_at: string;
  is_active: boolean;
  sport?: string; // 'tenis' | 'padel'
}

/**
 * Genera los horarios de inicio (Date locales) válidos para una cancha en un día dado.
 * Slots de tamaño slot_minutes desde opens_at hasta closes_at - slot_minutes.
 */
export function generateSlots(court: CourtLite, day: Date): Date[] {
  const [oh, om] = court.opens_at.split(":").map(Number);
  const [ch, cm] = court.closes_at.split(":").map(Number);
  const start = set(startOfDay(day), { hours: oh, minutes: om, seconds: 0, milliseconds: 0 });
  const end = set(startOfDay(day), { hours: ch, minutes: cm, seconds: 0, milliseconds: 0 });
  const slots: Date[] = [];
  let cursor = start;
  while (true) {
    const next = addMinutes(cursor, court.slot_minutes);
    if (next > end) break;
    slots.push(cursor);
    cursor = next;
  }
  return slots;
}

export function formatSlotLabel(d: Date): string {
  return format(d, "HH:mm");
}

export function isSlotInPast(slotStart: Date): boolean {
  return isBefore(slotStart, new Date());
}

export interface BookingLite {
  id: string;
  court_id: string;
  user_id: string;
  starts_at: string; // ISO
  ends_at: string;
  status: "confirmada" | "cancelada";
}

/** Devuelve la reserva confirmada que ocupa este slot exacto, si existe. */
export function findBookingForSlot(
  bookings: BookingLite[],
  courtId: string,
  slotStart: Date,
): BookingLite | undefined {
  return bookings.find((b) => {
    if (b.court_id !== courtId || b.status !== "confirmada") return false;
    const bs = parseISO(b.starts_at);
    return bs.getTime() === slotStart.getTime();
  });
}

export const dayLabel = (d: Date): string => {
  const today = new Date();
  if (isSameDay(d, today)) return "Hoy";
  if (isSameDay(d, addMinutes(today, 60 * 24))) return "Mañana";
  return format(d, "EEE d MMM");
};

/**
 * Devuelve true si todos los slots consecutivos cubiertos por `durationMinutes`
 * a partir de `slotStart` están libres en la cancha indicada.
 * Asume slots de tamaño `court.slot_minutes`.
 */
export function areConsecutiveSlotsFree(
  bookings: BookingLite[],
  court: CourtLite,
  slotStart: Date,
  durationMinutes: number,
): boolean {
  const slotsNeeded = Math.ceil(durationMinutes / court.slot_minutes);
  for (let i = 0; i < slotsNeeded; i++) {
    const s = addMinutes(slotStart, i * court.slot_minutes);
    if (findBookingForSlot(bookings, court.id, s)) return false;
    if (isSlotInPast(s) && i > 0) return false;
  }
  // Also check that the end time doesn't exceed closing hour
  const [ch, cm] = court.closes_at.split(":").map(Number);
  const closes = new Date(slotStart);
  closes.setHours(ch, cm, 0, 0);
  const end = addMinutes(slotStart, durationMinutes);
  if (end > closes) return false;
  return true;
}

export interface CourtSurfaceGroup {
  key: "padel" | "dura" | "arcilla" | "otra";
  label: string;
  badgeClass: string;
  courts: CourtLite[];
}

/**
 * Agrupa canchas por deporte/superficie. Las canchas de pádel forman su propio grupo;
 * las de tenis se separan por superficie (dura / arcilla / otras).
 */
export function groupCourtsBySurface(courts: CourtLite[]): CourtSurfaceGroup[] {
  const padel: CourtLite[] = [];
  const dura: CourtLite[] = [];
  const arcilla: CourtLite[] = [];
  const otra: CourtLite[] = [];
  for (const c of courts) {
    if ((c.sport ?? "tenis") === "padel") {
      padel.push(c);
      continue;
    }
    const s = (c.surface ?? "").toLowerCase();
    if (s.includes("dura") || s.includes("hard") || s.includes("cemento")) dura.push(c);
    else if (s.includes("arcilla") || s.includes("clay") || s.includes("polvo")) arcilla.push(c);
    else otra.push(c);
  }
  const groups: CourtSurfaceGroup[] = [];
  if (padel.length)
    groups.push({
      key: "padel",
      label: "Pádel",
      badgeClass: "bg-accent/20 text-accent-foreground",
      courts: padel,
    });
  if (dura.length)
    groups.push({
      key: "dura",
      label: "Canchas duras",
      badgeClass: "bg-muted text-muted-foreground",
      courts: dura,
    });
  if (arcilla.length)
    groups.push({
      key: "arcilla",
      label: "Arcilla",
      badgeClass: "bg-primary/15 text-primary",
      courts: arcilla,
    });
  if (otra.length)
    groups.push({
      key: "otra",
      label: "Otras",
      badgeClass: "bg-accent/15 text-accent-foreground",
      courts: otra,
    });
  return groups;
}
