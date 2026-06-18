import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { addDays, addMinutes, format, parseISO, startOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowLeft, CalendarDays, Clock, Loader2, MapPin, Sun, Sunset, Moon, X } from "lucide-react";
import { useMyUpcomingBookings } from "@/components/UpcomingBookingsLink";
import { useQueryClient } from "@tanstack/react-query";
import { PartnerPicker } from "@/components/PartnerPicker";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import { useBookingsProvider, openExternalBooking } from "@/hooks/useBookingsProvider";
import { useClubBrand } from "@/components/providers/ClubBrandProvider";
import { useActiveSport } from "@/components/providers/SportProvider";
import { Button } from "@/components/ui/button";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/EmptyState";
import { BottomNav } from "@/components/BottomNav";
import { ScheduleDialog } from "@/components/tournaments/ScheduleDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Court as TournamentCourt, Match as TournamentMatch } from "@/hooks/useCategoryData";
import { toast } from "sonner";
import {
  areConsecutiveSlotsFree,
  type BookingLite,
  type CourtLite,
  dayLabel,
  findBookingForSlot,
  formatSlotLabel,
  generateSlots,
  groupCourtsBySurface,
  isSlotInPast,
} from "@/lib/booking-utils";
import { cn } from "@/lib/utils";
import { AddToCalendarButton } from "@/components/shared/AddToCalendarButton";
import { SportBadge } from "@/components/SportBadge";

interface BookingRow extends BookingLite {
  user_id: string;
}

interface ProfileLite {
  user_id: string;
  first_name: string;
  last_name: string;
}

interface TournamentBookingMeta {
  match_id: string;
  category_name: string;
  category_id: string;
  tournament_slug: string;
  tournament_name: string;
  round: number;
  match_status: string;
  scheduled_at: string | null;
  player_a: string;
  player_b: string;
  is_mine: boolean;
}

type Duration = 60 | 90 | 120;
const DURATIONS: Duration[] = [60, 90, 120];

const MyBookingsHeaderLink = () => {
  const { data } = useMyUpcomingBookings(50);
  const total = data?.length ?? 0;
  if (total === 0) return null;
  const label = total === 1 ? "1 reserva activa" : `${total} reservas activas`;
  return (
    <Link
      to="/mis-reservas"
      aria-label={`Ver mis próximas reservas — ${label}`}
      title={label}
      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-2.5 text-xs font-semibold text-foreground transition-smooth hover:border-primary/40 hover:bg-primary/5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <CalendarDays className="h-4 w-4 text-primary" strokeWidth={2.2} aria-hidden="true" />
      <span aria-hidden="true" className="tabular-nums">{total}</span>
      <span className="sr-only">{label}</span>
    </Link>
  );
};

const Reservar = () => {
  const { user, profile, isAdmin } = useAuth();
  const { brand } = useClubBrand();
  const { sport: activeSport } = useActiveSport();
  const { isExternal, externalUrl, isLoading: providerLoading } = useBookingsProvider();
  const qc = useQueryClient();

  // Reservas delegadas a proveedor externo: abrir URL y volver al Home.
  useEffect(() => {
    if (!providerLoading && isExternal) {
      openExternalBooking(externalUrl);
    }
  }, [providerLoading, isExternal, externalUrl]);
  if (!providerLoading && isExternal) {
    return <Navigate to="/" replace />;
  }

  const [courts, setCourts] = useState<CourtLite[]>([]);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileLite>>({});
  const [tournamentBookings, setTournamentBookings] = useState<Record<string, TournamentBookingMeta>>({});
  const [maxAdvanceDays, setMaxAdvanceDays] = useState(7);
  const [minCancelHours, setMinCancelHours] = useState(4);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<Date>(startOfDay(new Date()));
  const [duration, setDuration] = useState<Duration>(60);
  const [selectedSlot, setSelectedSlot] = useState<Date | null>(null);
  const [pending, setPending] = useState<{ court: CourtLite; start: Date; duration: Duration } | null>(null);
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<BookingRow | null>(null);
  const [rescheduleMatch, setRescheduleMatch] = useState<TournamentMatch | null>(null);
  const [tournamentCancelTarget, setTournamentCancelTarget] = useState<{
    booking: BookingRow;
    meta: TournamentBookingMeta;
  } | null>(null);
  const [tournamentCancelMode, setTournamentCancelMode] = useState<"unschedule" | "cancel_match">("unschedule");

  // Reset selected slot when day or duration changes
  useEffect(() => {
    setSelectedSlot(null);
  }, [selectedDay, duration]);

  const tenantId = profile?.tenant_id;

  const loadAll = async () => {
    if (!tenantId) return;
    setLoading(true);
    const dayStart = startOfDay(selectedDay).toISOString();
    const dayEnd = startOfDay(addDays(selectedDay, 1)).toISOString();
    const [courtsRes, bookingsRes, rulesRes] = await Promise.all([
      supabase
        .from("courts")
        .select("id, name, surface, slot_minutes, opens_at, closes_at, is_active, sport")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .order("sort_order"),
      supabase
        .from("bookings")
        .select("id, court_id, user_id, starts_at, ends_at, status")
        .eq("tenant_id", tenantId)
        .eq("status", "confirmada")
        .gte("starts_at", dayStart)
        .lt("starts_at", dayEnd),
      supabase
        .from("booking_rules")
        .select("max_advance_days, min_cancel_hours")
        .eq("tenant_id", tenantId)
        .maybeSingle(),
    ]);
    const cs = (courtsRes.data ?? []) as CourtLite[];
    const bs = (bookingsRes.data ?? []) as BookingRow[];
    setCourts(cs);
    setBookings(bs);
    if (rulesRes.data) {
      setMaxAdvanceDays(rulesRes.data.max_advance_days ?? 7);
      setMinCancelHours(rulesRes.data.min_cancel_hours ?? 4);
    }
    const userIds = Array.from(new Set(bs.map((b) => b.user_id)));
    const map: Record<string, ProfileLite> = {};
    if (userIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles_directory")
        .select("user_id, first_name, last_name")
        .in("user_id", userIds);
      (profs ?? []).forEach((p) => {
        map[p.user_id] = p as ProfileLite;
      });
      setProfiles(map);
    } else {
      setProfiles({});
    }

    const bookingIds = bs.map((b) => b.id);
    if (bookingIds.length > 0) {
      const { data: matches } = await supabase
        .from("tournament_matches")
        .select(
          "id, booking_id, registration_a_id, registration_b_id, round, status, scheduled_at, tournament_category_id, category:tournament_categories(name), tournament:tournaments(slug, name)",
        )
        .in("booking_id", bookingIds);
      const regIds = Array.from(
        new Set(
          (matches ?? [])
            .flatMap((m: any) => [m.registration_a_id, m.registration_b_id])
            .filter(Boolean) as string[],
        ),
      );
      const regMap: Record<string, { p1?: string; p2?: string }> = {};
      const playerIds = new Set<string>();
      if (regIds.length > 0) {
        const { data: regs } = await supabase
          .from("tournament_registrations")
          .select("id, player1_user_id, player2_user_id")
          .in("id", regIds);
        (regs ?? []).forEach((r) => {
          regMap[r.id] = { p1: r.player1_user_id, p2: r.player2_user_id ?? undefined };
          if (r.player1_user_id) playerIds.add(r.player1_user_id);
          if (r.player2_user_id) playerIds.add(r.player2_user_id);
        });
      }
      const playerMap: Record<string, ProfileLite> = {};
      const missing = Array.from(playerIds).filter((id) => !map[id]);
      if (missing.length > 0) {
        const { data: extraProfs } = await supabase
          .from("profiles_directory")
          .select("user_id, first_name, last_name")
          .in("user_id", missing);
        (extraProfs ?? []).forEach((p) => {
          playerMap[p.user_id] = p as ProfileLite;
        });
      }
      const allProfiles = { ...map, ...playerMap };
      const fmt = (uid?: string) => {
        if (!uid) return null;
        const p = allProfiles[uid];
        return p ? `${p.first_name} ${p.last_name.charAt(0)}.` : "Jugador";
      };
      const tmap: Record<string, TournamentBookingMeta> = {};
      (matches ?? []).forEach((m: any) => {
        if (!m.booking_id) return;
        const ra = regMap[m.registration_a_id];
        const rb = regMap[m.registration_b_id];
        const aLabel = ra ? [fmt(ra.p1), fmt(ra.p2)].filter(Boolean).join(" / ") : "?";
        const bLabel = rb ? [fmt(rb.p1), fmt(rb.p2)].filter(Boolean).join(" / ") : "?";
        const meUid = user?.id;
        const isMine = !!meUid && [ra?.p1, ra?.p2, rb?.p1, rb?.p2].includes(meUid);
        tmap[m.booking_id] = {
          match_id: m.id,
          category_name: m.category?.name ?? "Torneo",
          category_id: m.tournament_category_id,
          tournament_slug: m.tournament?.slug ?? "",
          tournament_name: m.tournament?.name ?? "Torneo",
          round: m.round,
          match_status: m.status,
          scheduled_at: m.scheduled_at,
          player_a: aLabel || "?",
          player_b: bLabel || "?",
          is_mine: isMine,
        };
      });
      if (Object.keys(playerMap).length > 0) {
        setProfiles((prev) => ({ ...prev, ...playerMap }));
      }
      setTournamentBookings(tmap);
    } else {
      setTournamentBookings({});
    }
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, selectedDay]);

  const days = useMemo(() => {
    const today = startOfDay(new Date());
    return Array.from({ length: maxAdvanceDays + 1 }, (_, i) => addDays(today, i));
  }, [maxAdvanceDays]);

  // Filtrar canchas por deporte activo (tenis vs pádel).
  const visibleCourts = useMemo(
    () => courts.filter((c) => (c.sport ?? "tenis") === activeSport),
    [courts, activeSport],
  );

  // Duraciones válidas: cada cancha tiene su slot_minutes; permitimos múltiplos hasta 120.
  // Para pádel (slot 90) → [90]. Para tenis (slot 60) → [60, 90, 120].
  const allowedDurations = useMemo<Duration[]>(() => {
    if (visibleCourts.length === 0) return DURATIONS;
    const minSlot = Math.min(...visibleCourts.map((c) => c.slot_minutes));
    return DURATIONS.filter((d) => d % minSlot === 0);
  }, [visibleCourts]);

  // Si la duración actual no es válida tras cambiar de deporte, ajustarla.
  useEffect(() => {
    if (allowedDurations.length === 0) return;
    if (!allowedDurations.includes(duration)) {
      setDuration(allowedDurations[0]);
    }
  }, [allowedDurations, duration]);

  const groupedCourts = useMemo(() => groupCourtsBySurface(visibleCourts), [visibleCourts]);

  // Unión de todos los slots de inicio posibles del día (por todas las canchas)
  // y para cada hora calculamos cuántas canchas están libres con la duración elegida.
  const availableHours = useMemo(() => {
    if (!visibleCourts.length) return [] as Array<{
      start: Date;
      key: string;
      period: "manana" | "tarde" | "noche";
      availableCourts: CourtLite[];
      totalCourts: number;
      courtStatuses: Array<{ court: CourtLite; free: boolean; offered: boolean }>;
    }>;
    const slotMap = new Map<string, Date>();
    for (const c of visibleCourts) {
      const slots = generateSlots(c, selectedDay);
      for (const s of slots) {
        if (isSlotInPast(s)) continue;
        slotMap.set(s.toISOString(), s);
      }
    }
    const result = Array.from(slotMap.values())
      .sort((a, b) => a.getTime() - b.getTime())
      .map((start) => {
        const courtStatuses = visibleCourts.map((c) => {
          const slotsForCourt = generateSlots(c, selectedDay);
          const offered = slotsForCourt.some((s) => s.getTime() === start.getTime());
          if (!offered) return { court: c, free: false, offered: false };
          const existing = findBookingForSlot(bookings, c.id, start);
          if (existing) return { court: c, free: false, offered: true };
          const free = areConsecutiveSlotsFree(bookings, c, start, duration);
          return { court: c, free, offered: true };
        });
        const availableCourts = courtStatuses.filter((s) => s.offered && s.free).map((s) => s.court);
        const h = start.getHours();
        const period: "manana" | "tarde" | "noche" = h < 12 ? "manana" : h < 18 ? "tarde" : "noche";
        return {
          start,
          key: start.toISOString(),
          period,
          availableCourts,
          totalCourts: visibleCourts.length,
          courtStatuses,
        };
      });
    return result;
  }, [visibleCourts, bookings, selectedDay, duration]);

  // Reservas propias del día (para sección rápida)
  const myBookingsToday = useMemo(
    () => bookings.filter((b) => b.user_id === user?.id).sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
    [bookings, user?.id],
  );

  const handleSlotClick = (court: CourtLite, slot: Date) => {
    if (duration > court.slot_minutes) {
      const ok = areConsecutiveSlotsFree(bookings, court, slot, duration);
      if (!ok) {
        const extra = duration - court.slot_minutes;
        toast.error(`Los siguientes ${extra} min no están libres en esta cancha`);
        return;
      }
    }
    setPending({ court, start: slot, duration });
  };

  const handleConfirm = async () => {
    if (!pending) return;
    if (!partnerId) {
      toast.error("Selecciona un compañero/a para reservar");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.rpc("create_booking", {
      _court_id: pending.court.id,
      _starts_at: pending.start.toISOString(),
      _partner_user_id: partnerId,
      _notes: undefined,
      _duration_minutes: pending.duration,
    } as any);
    setSubmitting(false);
    if (error) {
      toast.error(error.message ?? "No se pudo crear la reserva");
      return;
    }
    toast.success("Reserva confirmada");
    setPending(null);
    setPartnerId(null);
    void qc.invalidateQueries({ queryKey: ["my-upcoming-bookings"] });
    await loadAll();
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    setSubmitting(true);
    const { error } = await supabase.rpc("cancel_booking", { _booking_id: cancelTarget.id });
    setSubmitting(false);
    if (error) {
      toast.error(error.message ?? "No se pudo cancelar");
      return;
    }
    toast.success("Reserva cancelada");
    setCancelTarget(null);
    void qc.invalidateQueries({ queryKey: ["my-upcoming-bookings"] });
    await loadAll();
  };

  const handleTournamentCancel = async () => {
    if (!tournamentCancelTarget) return;
    const { meta } = tournamentCancelTarget;
    setSubmitting(true);
    const { error: unschedErr } = await supabase.rpc("unschedule_match", { _match_id: meta.match_id });
    if (unschedErr) {
      setSubmitting(false);
      toast.error(unschedErr.message ?? "No se pudo liberar la cancha");
      return;
    }
    if (tournamentCancelMode === "cancel_match") {
      const { error: cancelErr } = await supabase
        .from("tournament_matches")
        .update({ status: "cancelado" })
        .eq("id", meta.match_id);
      if (cancelErr) {
        setSubmitting(false);
        toast.error(cancelErr.message ?? "Cancha liberada, pero no se pudo marcar el partido como cancelado");
        return;
      }
    }
    setSubmitting(false);
    toast.success(
      tournamentCancelMode === "cancel_match"
        ? "Partido cancelado y cancha liberada"
        : "Cancha liberada · partido vuelve a 'pendiente'",
    );
    setTournamentCancelTarget(null);
    setTournamentCancelMode("unschedule");
    void qc.invalidateQueries({ queryKey: ["my-upcoming-bookings"] });
    await loadAll();
  };

  const courtsForDialog = courts as unknown as TournamentCourt[];

  // Tarjeta horizontal de cancha para el slot seleccionado.
  const renderCourtRow = (court: CourtLite, slot: Date) => {
    const booking = findBookingForSlot(bookings, court.id, slot);
    const mine = booking?.user_id === user?.id;
    const occupant = booking ? profiles[booking.user_id] : undefined;
    const surface = (court.surface ?? "").toLowerCase();
    const isClay = surface.includes("arcilla") || surface.includes("clay") || surface.includes("polvo");
    const surfaceIconClass = isClay ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground";
    const surfaceBorderClass = isClay
      ? "border-l-4 border-l-primary"
      : "border-l-4 border-l-[hsl(var(--court-hard))]";

    const SurfaceIcon = (
      <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl", surfaceIconClass)}>
        <MapPin className="h-5 w-5" />
      </div>
    );

    const Header = (
      <div className="min-w-0 flex-1">
        <p className="font-display text-sm font-semibold text-foreground truncate">{court.name}</p>
        <p className="text-[11px] capitalize text-muted-foreground truncate">
          {court.surface} · {formatSlotLabel(slot)}—{format(addMinutes(slot, duration), "HH:mm")}
        </p>
      </div>
    );

    if (booking) {
      const tournamentMeta = tournamentBookings[booking.id];
      const isTournament = !!tournamentMeta;
      const isMyTournament = isTournament && tournamentMeta.is_mine;
      const cancellable = mine && !isTournament;

      if (isTournament) {
        const meta = tournamentMeta!;
        const statusLabel: Record<string, string> = {
          programado: "Programado",
          jugado: "Jugado",
          pendiente: "Pendiente",
          walkover: "Walkover",
          cancelado: "Cancelado",
        };
        return (
          <Popover key={court.id}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  "flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-smooth",
                  surfaceBorderClass,
                  isMyTournament
                    ? "border-primary/50 bg-primary/10 hover:bg-primary/15"
                    : "border-accent/40 bg-accent/10 hover:bg-accent/20",
                )}
              >
                {SurfaceIcon}
                <div className="min-w-0 flex-1">
                  <p className="font-display text-sm font-semibold text-foreground truncate">{court.name}</p>
                  <p className={cn("text-[11px] font-medium uppercase tracking-wider truncate", isMyTournament ? "text-primary" : "text-accent-foreground/80")}>
                    {isMyTournament ? "Tu partido" : "Torneo"} · {meta.category_name}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {meta.player_a} vs {meta.player_b}
                  </p>
                </div>
                <Badge variant="secondary" className="shrink-0 text-[10px]">
                  {statusLabel[meta.match_status] ?? meta.match_status}
                </Badge>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-72 rounded-2xl p-4" align="start">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {meta.tournament_name}
                    </p>
                    <p className="font-display text-base font-semibold leading-tight text-foreground">
                      {meta.category_name}
                    </p>
                  </div>
                  <Badge
                    variant={meta.match_status === "jugado" ? "secondary" : "default"}
                    className="shrink-0 text-[10px]"
                  >
                    {statusLabel[meta.match_status] ?? meta.match_status}
                  </Badge>
                </div>

                <div className="space-y-1 text-xs text-muted-foreground">
                  <p>
                    <span className="font-medium text-foreground">Ronda:</span> {meta.round}
                  </p>
                  <p>
                    <span className="font-medium text-foreground">Cancha:</span> {court.name}
                  </p>
                  <p>
                    <span className="font-medium text-foreground">Hora:</span>{" "}
                    {meta.scheduled_at
                      ? format(parseISO(meta.scheduled_at), "EEEE d MMM · HH:mm", { locale: es })
                      : formatSlotLabel(slot)}
                  </p>
                </div>

                <div className="rounded-xl bg-muted/50 p-2 text-xs">
                  <p className={cn("truncate", isMyTournament && "font-semibold text-primary")}>
                    {meta.player_a}
                  </p>
                  <p className="my-0.5 text-center text-[10px] uppercase tracking-wider text-muted-foreground">
                    vs
                  </p>
                  <p className={cn("truncate", isMyTournament && "font-semibold text-primary")}>
                    {meta.player_b}
                  </p>
                </div>

                {meta.tournament_slug && (
                  <Link
                    to={`/torneos/${meta.tournament_slug}/cat/${meta.category_id}`}
                    className="block w-full rounded-xl bg-primary px-3 py-2 text-center text-xs font-semibold text-primary-foreground transition-smooth hover:bg-primary/90"
                  >
                    Ver detalle del torneo
                  </Link>
                )}

                {isAdmin && meta.match_status !== "jugado" && meta.match_status !== "cancelado" && (
                  <div className="space-y-1.5 border-t border-border pt-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Acciones admin
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 w-full text-xs"
                      onClick={() =>
                        setRescheduleMatch({
                          id: meta.match_id,
                          scheduled_at: meta.scheduled_at,
                        } as TournamentMatch)
                      }
                    >
                      Reprogramar
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="h-8 w-full text-xs"
                      onClick={() => {
                        setTournamentCancelMode("unschedule");
                        setTournamentCancelTarget({ booking, meta });
                      }}
                    >
                      Cancelar booking
                    </Button>
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>
        );
      }

      // Reserva normal (mía u ocupada)
      return (
        <button
          key={court.id}
          type="button"
          disabled={!cancellable}
          onClick={() => cancellable && setCancelTarget(booking)}
          className={cn(
            "flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-smooth",
            surfaceBorderClass,
            mine
              ? "border-primary bg-primary/10 hover:bg-primary/15"
              : "border-border bg-muted/40",
          )}
        >
          {SurfaceIcon}
          {Header}
          <Badge
            variant={mine ? "default" : "secondary"}
            className="shrink-0 text-[10px]"
          >
            {mine
              ? "Tu reserva"
              : occupant
                ? `${occupant.first_name} ${occupant.last_name.charAt(0)}.`
                : "Reservado"}
          </Badge>
        </button>
      );
    }

    // Disponible: validar duración
    const fits = duration <= court.slot_minutes
      ? true
      : areConsecutiveSlotsFree(bookings, court, slot, duration);

    return (
      <button
        key={court.id}
        type="button"
        onClick={() => fits && handleSlotClick(court, slot)}
        disabled={!fits}
        className={cn(
          "group flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-smooth",
          surfaceBorderClass,
          fits
            ? "border-border bg-card hover:border-primary hover:bg-primary/5"
            : "cursor-not-allowed border-dashed border-border/60 bg-muted/30 opacity-60",
        )}
      >
        {SurfaceIcon}
        {Header}
        <span
          className={cn(
            "shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-smooth",
            fits
              ? "bg-primary text-primary-foreground group-hover:brightness-110"
              : "bg-muted text-muted-foreground",
          )}
        >
          {fits ? "Reservar" : "No cabe"}
        </span>
      </button>
    );
  };

  const periodLabels: Record<"manana" | "tarde" | "noche", { label: string; Icon: typeof Sun }> = {
    manana: { label: "Mañana", Icon: Sun },
    tarde: { label: "Tarde", Icon: Sunset },
    noche: { label: "Noche", Icon: Moon },
  };

  return (
    <div className="min-h-screen bg-gradient-warm">
      <header className="safe-top sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-md items-center gap-3 px-5 pb-3 pt-3">
          <Link
            to="/"
            className="flex h-9 w-9 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground hover:text-foreground"
            aria-label="Volver al inicio"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-xl font-semibold leading-tight">Reservar cancha</h1>
            <p className="truncate text-xs text-muted-foreground">
              {brand.shortName} · {dayLabel(selectedDay)} · {duration} min
            </p>
          </div>
          <SportBadge />
          <MyBookingsHeaderLink />
        </div>
      </header>

      <main className="mx-auto max-w-md space-y-6 px-5 pt-4 pb-28">
        {/* PASO 1 — Día */}
        <section aria-label="Selector de fecha" className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              1 · Elige día
            </p>
            <p className="text-[10px] text-muted-foreground">Hasta {maxAdvanceDays} días</p>
          </div>
          <div className="-mx-5 overflow-x-auto px-5 pb-1">
            <div className="inline-flex divide-x divide-border overflow-hidden rounded-xl border border-border bg-card">
              {days.map((d) => {
                const active = d.getTime() === selectedDay.getTime();
                return (
                  <button
                    key={d.toISOString()}
                    onClick={() => setSelectedDay(d)}
                    className={cn(
                      "flex min-w-[68px] flex-col items-center px-3 py-2 text-xs transition-smooth",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground hover:bg-muted",
                    )}
                  >
                    <span className="text-[10px] uppercase tracking-wider opacity-80">{dayLabel(d)}</span>
                    <span className="font-display text-lg font-semibold leading-tight">
                      {format(d, "d", { locale: es })}
                    </span>
                    <span className="text-[10px] capitalize opacity-80">
                      {format(d, "MMM", { locale: es })}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* PASO 2 — Duración */}
        <section aria-label="Selector de duración" className="space-y-2">
          <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            2 · Duración
          </p>
          <div className="flex divide-x divide-border overflow-hidden rounded-xl border border-border bg-card">
            {allowedDurations.map((d) => {
              const active = duration === d;
              const label = d === 60 ? "1h" : d === 90 ? "1h30" : "2h";
              return (
                <button
                  key={d}
                  onClick={() => setDuration(d)}
                  className={cn(
                    "flex flex-1 flex-col items-center px-3 py-3 text-sm transition-smooth",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-muted",
                  )}
                >
                  <span className="font-display text-lg font-bold leading-tight">{label}</span>
                  <span className="text-[10px] uppercase tracking-wider opacity-80">duración</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Tus reservas de hoy (acceso rápido) */}
        {!loading && myBookingsToday.length > 0 && (
          <section aria-label="Tus reservas del día" className="space-y-2">
            <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Tus reservas hoy
            </p>
            <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
              {myBookingsToday.map((b) => {
                const c = courts.find((cc) => cc.id === b.court_id);
                const start = parseISO(b.starts_at);
                return (
                  <button
                    key={b.id}
                    onClick={() => setCancelTarget(b)}
                    className="flex shrink-0 items-center gap-2 rounded-2xl border border-primary/40 bg-primary/10 px-3 py-2 text-left transition-smooth hover:bg-primary/15"
                  >
                    <Clock className="h-4 w-4 text-primary" />
                    <div>
                      <p className="font-display text-sm font-semibold leading-tight text-foreground">
                        {format(start, "HH:mm")}—{format(parseISO(b.ends_at), "HH:mm")}
                      </p>
                      <p className="text-[10px] text-muted-foreground">{c?.name ?? "Cancha"}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* PASO 3 — Hora */}
        <section aria-label="Selector de hora" className="space-y-3">
          <div className="flex items-baseline justify-between px-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              3 · Elige hora
            </p>
            {!loading && availableHours.length > 0 && (
              <p className="text-[10px] text-muted-foreground">
                {availableHours.filter((h) => h.availableCourts.length > 0).length} horarios disponibles
              </p>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : visibleCourts.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title={activeSport === "padel" ? "Sin canchas de pádel" : "Sin canchas disponibles"}
              description={
                activeSport === "padel"
                  ? "Tu club aún no tiene canchas de pádel configuradas. Cambia a tenis en el selector del header."
                  : "Tu club aún no tiene canchas configuradas."
              }
            />
          ) : availableHours.length === 0 ? (
            <EmptyState
              icon={Clock}
              title="No hay horarios"
              description="No quedan horarios para este día. Prueba con otro día."
            />
          ) : (
            <div className="space-y-4">
              {(["manana", "tarde", "noche"] as const).map((period) => {
                const hours = availableHours.filter((h) => h.period === period);
                if (hours.length === 0) return null;
                const { label, Icon } = periodLabels[period];
                return (
                  <div key={period} className="space-y-2">
                    <div className="flex items-center gap-1.5 px-1">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {label}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 xs:grid-cols-4 sm:grid-cols-6 md:grid-cols-8">
                      {hours.map((h) => {
                        const available = h.availableCourts.length;
                        const total = h.totalCourts;
                        const active = selectedSlot?.getTime() === h.start.getTime();
                        const disabled = available === 0;
                        const offeredStatuses = h.courtStatuses.filter((s) => s.offered);
                        const hardStatuses = offeredStatuses.filter(({ court }) => {
                          const s = (court.surface ?? "").toLowerCase();
                          return s.includes("dura") || s.includes("hard") || s.includes("cemento");
                        });
                        const clayStatuses = offeredStatuses.filter(({ court }) => {
                          const s = (court.surface ?? "").toLowerCase();
                          return s.includes("arcilla") || s.includes("clay") || s.includes("polvo");
                        });
                        const renderDot = (
                          court: { id: string; name: string },
                          free: boolean,
                          isHard: boolean,
                        ) => {
                          const haloVar = isHard ? "--court-hard" : "--court-clay";
                          return (
                            <span
                              key={court.id}
                              className="relative inline-flex h-1.5 w-1.5 shrink-0 rounded-full sm:h-2 sm:w-2"
                              style={{
                                backgroundColor: active
                                  ? `hsl(var(--primary-foreground) / 0.35)`
                                  : `hsl(var(${haloVar}) / 0.35)`,
                              }}
                              title={`${court.name}: ${free ? "libre" : "ocupada"}`}
                            >
                              <span
                                className={cn(
                                  "absolute inset-[1.5px] rounded-full sm:inset-[2px]",
                                  active
                                    ? free
                                      ? "bg-primary-foreground"
                                      : "bg-primary-foreground/50"
                                    : free
                                      ? "bg-success"
                                      : "bg-destructive/70",
                                )}
                              />
                            </span>
                          );
                        };
                        return (
                          <button
                            key={h.key}
                            type="button"
                            disabled={disabled}
                            onClick={() => setSelectedSlot(h.start)}
                            aria-pressed={active}
                            className={cn(
                              "flex flex-col items-center rounded-lg border px-1.5 py-2 transition-smooth",
                              active
                                ? "border-primary bg-primary text-primary-foreground shadow-clay"
                                : disabled
                                  ? "cursor-not-allowed border-dashed border-border/60 bg-muted/30 text-muted-foreground/50"
                                  : "border-border bg-card text-foreground hover:border-primary hover:bg-primary/5",
                            )}
                          >
                            <span className="font-display text-base font-semibold leading-tight">
                              {formatSlotLabel(h.start)}
                            </span>
                            {disabled ? (
                              <span
                                className={cn(
                                  "mt-1 text-[10px] uppercase tracking-wider",
                                  active ? "text-primary-foreground/85" : "text-muted-foreground/60",
                                )}
                                aria-label="Sin canchas disponibles"
                              >
                                Ocupado
                              </span>
                            ) : (
                              <span
                                className="mt-1 flex w-full max-w-full flex-wrap items-center justify-center gap-y-[2px] gap-x-[3px] overflow-hidden sm:gap-x-[5px]"
                                aria-label={`${available} de ${total} canchas disponibles`}
                              >
                                {hardStatuses.length > 0 && (
                                  <span className="flex flex-wrap items-center justify-center gap-y-[2px] gap-x-px sm:gap-x-[2px]">
                                    {hardStatuses.map(({ court, free }) =>
                                      renderDot(court, free, true),
                                    )}
                                  </span>
                                )}
                                {clayStatuses.length > 0 && (
                                  <span className="flex flex-wrap items-center justify-center gap-y-[2px] gap-x-px sm:gap-x-[2px]">
                                    {clayStatuses.map(({ court, free }) =>
                                      renderDot(court, free, false),
                                    )}
                                  </span>
                                )}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* PASO 4 — Cancha (aparece tras elegir hora) */}
        {!loading && selectedSlot && visibleCourts.length > 0 && (
          <section
            aria-label="Selector de cancha"
            className="space-y-4 animate-in fade-in-0 slide-in-from-top-2 duration-200"
          >
            <div className="flex items-baseline justify-between px-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                4 · Elige cancha
              </p>
              <p className="text-[10px] text-muted-foreground">
                {formatSlotLabel(selectedSlot)}—{format(addMinutes(selectedSlot, duration), "HH:mm")}
              </p>
            </div>
            <div className="space-y-5">
              {groupedCourts.map((group) => (
                <div key={group.key} className="space-y-2">
                  <div className="flex items-center gap-2 px-1">
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                        group.badgeClass,
                      )}
                    >
                      {group.label}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {group.courts.length} {group.courts.length === 1 ? "cancha" : "canchas"}
                    </span>
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    {group.courts.map((c) => renderCourtRow(c, selectedSlot))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <p className="px-1 text-center text-[11px] text-muted-foreground">
          Cancela con al menos {minCancelHours}h de anticipación.
        </p>
      </main>

      {/* Confirmar reserva */}
      <Dialog
        open={!!pending}
        onOpenChange={(o) => {
          if (!o) {
            setPending(null);
            setPartnerId(null);
          }
        }}
      >
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle className="font-display">Confirmar reserva</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-1">
                {pending && (
                  <>
                    <p className="text-foreground">
                      <strong>{pending.court.name}</strong> · {pending.court.surface}
                    </p>
                    <p>
                      {format(pending.start, "EEEE d 'de' MMMM", { locale: es })} ·{" "}
                      {formatSlotLabel(pending.start)}—
                      {format(addMinutes(pending.start, pending.duration), "HH:mm")}
                      {" · "}
                      <span className="font-medium text-foreground">{pending.duration} min</span>
                    </p>
                  </>
                )}
              </div>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Compañero/a · obligatorio
            </label>
            <PartnerPicker value={partnerId} onChange={(id) => setPartnerId(id)} />
            <p className="text-[11px] text-muted-foreground">
              Toda reserva requiere otro socio del club. La cancha quedará bloqueada para ambos.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setPending(null);
                setPartnerId(null);
              }}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button variant="clay" onClick={handleConfirm} disabled={submitting || !partnerId}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar reserva"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancelar reserva */}
      <Dialog open={!!cancelTarget} onOpenChange={(o) => !o && setCancelTarget(null)}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle className="font-display">Tu reserva</DialogTitle>
            <DialogDescription>
              {cancelTarget && (
                <>
                  {format(parseISO(cancelTarget.starts_at), "EEEE d 'de' MMMM 'a las' HH:mm", { locale: es })}
                  {" · "}
                  {courts.find((c) => c.id === cancelTarget.court_id)?.name ?? "cancha"}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {cancelTarget && (
            <div className="flex justify-center pb-2">
              <AddToCalendarButton
                title={`Reserva · ${courts.find((c) => c.id === cancelTarget.court_id)?.name ?? "cancha"}`}
                description="Reserva confirmada"
                location={courts.find((c) => c.id === cancelTarget.court_id)?.name}
                startsAt={cancelTarget.starts_at}
                endsAt={cancelTarget.ends_at}
                filename={`reserva-${cancelTarget.id}.ics`}
              />
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setCancelTarget(null)} disabled={submitting}>
              Volver
            </Button>
            <Button variant="destructive" onClick={handleCancel} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><X className="h-4 w-4" /> Cancelar reserva</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reagendar partido (admin) */}
      <ScheduleDialog
        open={!!rescheduleMatch}
        onOpenChange={(o) => !o && setRescheduleMatch(null)}
        match={rescheduleMatch}
        courts={courtsForDialog}
        mode="reschedule_admin"
        onScheduled={() => {
          setRescheduleMatch(null);
          loadAll();
        }}
      />

      {/* Cancelar booking de torneo (admin) */}
      <AlertDialog
        open={!!tournamentCancelTarget}
        onOpenChange={(o) => {
          if (!o) {
            setTournamentCancelTarget(null);
            setTournamentCancelMode("unschedule");
          }
        }}
      >
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Cancelar booking de torneo</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                {tournamentCancelTarget && (
                  <p>
                    <span className="font-medium text-foreground">
                      {tournamentCancelTarget.meta.category_name}
                    </span>{" "}
                    · {tournamentCancelTarget.meta.player_a} vs {tournamentCancelTarget.meta.player_b}
                  </p>
                )}
                <p>Elige qué hacer con el partido:</p>
                <div className="space-y-2">
                  <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-border p-3 transition-smooth hover:bg-muted/50 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                    <input
                      type="radio"
                      name="cancel-mode"
                      value="unschedule"
                      checked={tournamentCancelMode === "unschedule"}
                      onChange={() => setTournamentCancelMode("unschedule")}
                      className="mt-0.5 accent-primary"
                    />
                    <span className="text-xs text-foreground">
                      <span className="font-semibold">Solo liberar cancha</span>
                      <br />
                      <span className="text-muted-foreground">
                        El partido vuelve a estado &quot;pendiente&quot; y deberá reprogramarse.
                      </span>
                    </span>
                  </label>
                  <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-border p-3 transition-smooth hover:bg-muted/50 has-[:checked]:border-destructive has-[:checked]:bg-destructive/5">
                    <input
                      type="radio"
                      name="cancel-mode"
                      value="cancel_match"
                      checked={tournamentCancelMode === "cancel_match"}
                      onChange={() => setTournamentCancelMode("cancel_match")}
                      className="mt-0.5 accent-destructive"
                    />
                    <span className="text-xs text-foreground">
                      <span className="font-semibold">Cancelar partido completo</span>
                      <br />
                      <span className="text-muted-foreground">
                        El partido queda marcado como &quot;cancelado&quot; y no se jugará.
                      </span>
                    </span>
                  </label>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Volver</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleTournamentCancel();
              }}
              disabled={submitting}
              className={cn(
                tournamentCancelMode === "cancel_match" &&
                  "bg-destructive text-destructive-foreground hover:bg-destructive/90",
              )}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : tournamentCancelMode === "cancel_match" ? (
                "Cancelar partido"
              ) : (
                "Liberar cancha"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BottomNav />
    </div>
  );
};

export default Reservar;
