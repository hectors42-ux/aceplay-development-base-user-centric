import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { format } from "date-fns";
import { es } from "date-fns/locale/es";
import { ArrowLeft, CalendarCheck, CalendarClock, Check, Clock, History, Loader2, MapPin, Trophy, X, XCircle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import { useBookingsProvider, openExternalBooking } from "@/hooks/useBookingsProvider";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { AddToCalendarButton } from "@/components/shared/AddToCalendarButton";
import { useQueryClient } from "@tanstack/react-query";
import { PartnerMatchResultWizard } from "@/components/partner/PartnerMatchResultWizard";
import { ExternalBookingCTA } from "@/components/booking/ExternalBookingCTA";
import { EXTERNAL_BOOKING_COPY } from "@/lib/external-bookings-copy";

interface PartnerResult {
  invitation_id: string;
  status: "propuesto" | "confirmado" | "rechazado";
  winner_user_id: string;
  loser_user_id: string;
  score: unknown | null;
  walkover: boolean;
  retired: boolean;
  proposed_by: string;
  proposed_at: string;
  confirmed_at: string | null;
  reject_reason: string | null;
}

interface Inv {
  id: string;
  tenant_id: string;
  inviter_user_id: string;
  invitee_user_id: string;
  status: string;
  selected_slot: { starts_at?: string; court_id?: string | null } | null;
  proposed_slots: Array<{ starts_at: string }>;
  message: string | null;
  booking_id: string | null;
  created_at: string;
  updated_at: string;
  responded_at: string | null;
  expires_at: string;
}

interface BookingLite {
  id: string;
  court_id: string;
  starts_at: string;
  created_at: string;
  cancelled_at: string | null;
}

interface ProfileLite {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
}

interface CourtLite {
  id: string;
  name: string;
  surface: string;
  slot_minutes: number;
}

const PARTNER_MATCH_DURATION_MINUTES = 90;

const initials = (a?: string | null, b?: string | null) =>
  `${a?.[0] ?? ""}${b?.[0] ?? ""}`.toUpperCase() || "?";

export default function PartnerMatchDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isExternal, externalUrl } = useBookingsProvider();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [inv, setInv] = useState<Inv | null>(null);
  const [counterpart, setCounterpart] = useState<ProfileLite | null>(null);
  const [courts, setCourts] = useState<CourtLite[]>([]);
  const [busyCourtIds, setBusyCourtIds] = useState<Set<string>>(new Set());
  const [selectedCourtId, setSelectedCourtId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [autoBooked, setAutoBooked] = useState(false);
  const [autoBookError, setAutoBookError] = useState<string | null>(null);
  const [booking, setBooking] = useState<BookingLite | null>(null);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleDateTime, setRescheduleDateTime] = useState("");
  const [rescheduleCourtId, setRescheduleCourtId] = useState<string | null>(null);
  const [rescheduling, setRescheduling] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [partnerResult, setPartnerResult] = useState<PartnerResult | null>(null);
  const [resultDialogOpen, setResultDialogOpen] = useState(false);
  const [resultBusy, setResultBusy] = useState(false);

  const startsAt = inv?.selected_slot?.starts_at ?? null;
  const startsAtDate = useMemo(() => (startsAt ? new Date(startsAt) : null), [startsAt]);
  const endsAtDate = useMemo(
    () => (startsAtDate ? new Date(startsAtDate.getTime() + PARTNER_MATCH_DURATION_MINUTES * 60_000) : null),
    [startsAtDate],
  );

  // Timeline derivado de timestamps disponibles en la invitación + booking
  const timeline = useMemo(() => {
    if (!inv) return [] as Array<{ ts: string; title: string; desc?: string }>;
    const events: Array<{ ts: string; title: string; desc?: string }> = [];
    events.push({
      ts: inv.created_at,
      title: "Invitación enviada",
      desc:
        inv.proposed_slots?.length > 0
          ? `${inv.proposed_slots.length} horario(s) propuestos`
          : undefined,
    });
    if (inv.responded_at) {
      const labels: Record<string, string> = {
        accepted: "Invitación aceptada",
        rejected: "Invitación rechazada",
        cancelled: "Invitación cancelada",
        expired: "Invitación expirada",
      };
      events.push({
        ts: inv.responded_at,
        title: labels[inv.status] ?? "Respuesta registrada",
        desc:
          inv.status === "accepted" && inv.selected_slot?.starts_at
            ? `Horario elegido: ${format(new Date(inv.selected_slot.starts_at), "EEE d MMM HH:mm 'h'", { locale: es })}`
            : undefined,
      });
    }
    if (booking) {
      events.push({
        ts: booking.created_at,
        title: "Cancha reservada",
        desc: `${courts.find((c) => c.id === booking.court_id)?.name ?? "Cancha"} · ${format(new Date(booking.starts_at), "HH:mm 'h'", { locale: es })}`,
      });
      if (booking.cancelled_at) {
        events.push({ ts: booking.cancelled_at, title: "Reserva cancelada" });
      }
    }
    if (inv.status === "expired" && !inv.responded_at) {
      events.push({ ts: inv.expires_at, title: "Invitación expirada", desc: "Sin respuesta" });
    }
    return events.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
  }, [inv, booking, courts]);

  const load = async (showSpinner = true) => {
    if (!id || !user) return;
    if (showSpinner) setLoading(true);

    const { data: invData, error } = await supabase
      .from("match_invitations")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error || !invData) {
      toast({ title: "Invitación no encontrada", variant: "destructive" });
      setLoading(false);
      return;
    }
    const i = invData as unknown as Inv;
    setInv(i);

    const otherId = i.inviter_user_id === user.id ? i.invitee_user_id : i.inviter_user_id;
    const { data: prof } = await supabase
      .from("profiles_directory")
      .select("user_id, first_name, last_name, avatar_url")
      .eq("user_id", otherId)
      .maybeSingle();
    setCounterpart(prof as ProfileLite | null);

    const slotIso = i.selected_slot?.starts_at;
    if (i.status === "accepted" && slotIso) {
      const slotStart = new Date(slotIso);
      const slotEnd = new Date(slotStart.getTime() + PARTNER_MATCH_DURATION_MINUTES * 60_000);
      const dayStart = new Date(slotStart);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const [{ data: cs }, { data: bs }, { data: cls }] = await Promise.all([
        supabase
          .from("courts")
          .select("id, name, surface, slot_minutes")
          .eq("tenant_id", i.tenant_id)
          .eq("is_active", true)
          .order("sort_order"),
        supabase
          .from("bookings")
          .select("court_id, starts_at, ends_at, status")
          .eq("tenant_id", i.tenant_id)
          .neq("status", "cancelada")
          .gte("starts_at", dayStart.toISOString())
          .lt("starts_at", dayEnd.toISOString()),
        supabase
          .from("coach_class_bookings")
          .select("court_id, starts_at, ends_at, status")
          .eq("tenant_id", i.tenant_id)
          .gte("starts_at", dayStart.toISOString())
          .lt("starts_at", dayEnd.toISOString()),
      ]);
      setCourts((cs ?? []) as CourtLite[]);
      const busy = new Set<string>();
      (bs ?? []).forEach((b: any) => {
        if (new Date(b.starts_at) < slotEnd && new Date(b.ends_at) > slotStart) busy.add(b.court_id);
      });
      (cls ?? []).forEach((c: any) => {
        if (
          c.status !== "cancelada" &&
          new Date(c.starts_at) < slotEnd &&
          new Date(c.ends_at) > slotStart
        )
          busy.add(c.court_id);
      });
      setBusyCourtIds(busy);
      // Preselect first available
      const firstFree = (cs ?? []).find((c: any) => !busy.has(c.id));
      setSelectedCourtId(firstFree?.id ?? null);
    }

    if (i.booking_id) {
      const { data: bk } = await supabase
        .from("bookings")
        .select("id, court_id, starts_at, created_at, cancelled_at")
        .eq("id", i.booking_id)
        .maybeSingle();
      setBooking((bk as BookingLite | null) ?? null);
    } else {
      setBooking(null);
    }

    // Cargar resultado del amistoso si existe
    const { data: pr } = await supabase
      .from("partner_match_results")
      .select("*")
      .eq("invitation_id", i.id)
      .maybeSingle();
    setPartnerResult((pr as PartnerResult | null) ?? null);

    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user]);

  // Realtime: refrescar si la reserva o la invitación cambian
  useEffect(() => {
    if (!inv) return;
    const uniq = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const ch = supabase
      .channel(`partner-match-${inv.id}-${uniq}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "match_invitations", filter: `id=eq.${inv.id}` },
        () => void load(false),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings", filter: `tenant_id=eq.${inv.tenant_id}` },
        () => void load(false),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inv?.id]);

  // Auto-reserva tras match auto-recíproco: si está aceptada, sin booking_id y hay cancha libre.
  // Bloqueado cuando el club delega reservas a un proveedor externo (no podemos crear bookings).
  useEffect(() => {
    if (isExternal) return;
    if (!inv || autoBooked || submitting) return;
    if (inv.status !== "accepted" || inv.booking_id) return;
    // No auto-reservar si el partido ya pasó
    if (startsAtDate && startsAtDate < new Date()) return;
    if (!startsAt || !counterpart || courts.length === 0) return;
    const firstFree = courts.find((c) => !busyCourtIds.has(c.id));
    if (!firstFree) return;
    setAutoBooked(true);
    (async () => {
      setSubmitting(true);
      // Reintentar con la siguiente cancha libre si la BD detecta un choque atómico
      const candidates = courts.filter((c) => !busyCourtIds.has(c.id));
      let newBookingId: string | null = null;
      let lastError: string | null = null;
      for (const candidate of candidates) {
        const { data: bookingData, error } = await supabase.rpc("create_booking", {
          _court_id: candidate.id,
          _starts_at: startsAt,
          _partner_user_id: counterpart.user_id,
          _notes: `Partner match: ${inv.message ?? ""}`.trim(),
          _duration_minutes: PARTNER_MATCH_DURATION_MINUTES,
        } as any);
        if (!error) {
          newBookingId = (bookingData as any)?.id ?? (bookingData as any) ?? null;
          break;
        }
        lastError = error.message;
        // Si NO es un choque, abortar; si es choque, probar siguiente cancha
        const isConflict = /ya fue tomado|ya está ocupado|exclusion/i.test(error.message);
        if (!isConflict) break;
      }
      if (!newBookingId) {
        setSubmitting(false);
        setAutoBookError(lastError ?? "No se pudo reservar");
        toast({
          title: "No pudimos reservar automáticamente",
          description: lastError ?? "Elige una cancha disponible manualmente.",
          variant: "destructive",
        });
        return;
      }
      await supabase
        .from("match_invitations")
        .update({ booking_id: newBookingId })
        .eq("id", inv.id);
      setSubmitting(false);
      toast({ title: "¡Cancha reservada!", description: "Tu partido quedó confirmado." });
      void qc.invalidateQueries({ queryKey: ["my-upcoming-bookings"] });
      void load(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inv?.status, inv?.booking_id, courts, busyCourtIds, startsAt, counterpart?.user_id]);

  const confirmBooking = async () => {
    if (!inv || !selectedCourtId || !startsAt || !counterpart) return;
    setSubmitting(true);
    const { data: bookingData, error } = await supabase.rpc("create_booking", {
      _court_id: selectedCourtId,
      _starts_at: startsAt,
      _partner_user_id: counterpart.user_id,
      _notes: `Partner match: ${inv.message ?? ""}`.trim(),
      _duration_minutes: PARTNER_MATCH_DURATION_MINUTES,
    } as any);
    if (error) {
      setSubmitting(false);
      toast({ title: "No se pudo reservar", description: error.message, variant: "destructive" });
      return;
    }
    const newBookingId = (bookingData as any)?.id ?? (bookingData as any) ?? null;
    if (newBookingId) {
      await supabase.from("match_invitations").update({ booking_id: newBookingId }).eq("id", inv.id);
    }
    setSubmitting(false);
    toast({ title: "¡Cancha reservada!", description: "Tu partido quedó confirmado." });
    void qc.invalidateQueries({ queryKey: ["my-upcoming-bookings"] });
    void load(false);
  };

  const openReschedule = () => {
    if (!startsAtDate || !inv) return;
    // Pre-llenar con horario actual + 1 día como sugerencia
    const suggested = new Date(startsAtDate.getTime() + 24 * 60 * 60_000);
    const pad = (n: number) => String(n).padStart(2, "0");
    const local = `${suggested.getFullYear()}-${pad(suggested.getMonth() + 1)}-${pad(suggested.getDate())}T${pad(suggested.getHours())}:${pad(suggested.getMinutes())}`;
    setRescheduleDateTime(local);
    setRescheduleCourtId(booking?.court_id ?? courts[0]?.id ?? null);
    setRescheduleOpen(true);
  };

  const submitReschedule = async () => {
    if (!inv || !rescheduleCourtId || !rescheduleDateTime) return;
    const newDate = new Date(rescheduleDateTime);
    if (Number.isNaN(newDate.getTime())) {
      toast({ title: "Fecha inválida", variant: "destructive" });
      return;
    }
    if (newDate < new Date()) {
      toast({ title: "La nueva fecha debe ser futura", variant: "destructive" });
      return;
    }
    setRescheduling(true);
    const { error } = await supabase.rpc("reschedule_partner_match", {
      _invitation_id: inv.id,
      _new_court_id: rescheduleCourtId,
      _new_starts_at: newDate.toISOString(),
      _duration_minutes: PARTNER_MATCH_DURATION_MINUTES,
    } as any);
    setRescheduling(false);
    if (error) {
      toast({ title: "No se pudo reprogramar", description: error.message, variant: "destructive" });
      return;
    }
    setRescheduleOpen(false);
    toast({ title: "Match reprogramado", description: "Se liberó la cancha anterior y se confirmó el nuevo horario." });
    void load(false);
  };

  const submitCancel = async () => {
    if (!inv) return;
    setCancelling(true);
    const { error } = await supabase.rpc("cancel_partner_match", {
      _invitation_id: inv.id,
      _reason: cancelReason.trim() || null,
    } as any);
    setCancelling(false);
    if (error) {
      toast({ title: "No se pudo cancelar", description: error.message, variant: "destructive" });
      return;
    }
    setCancelOpen(false);
    setCancelReason("");
    toast({ title: "Match cancelado", description: "La reserva asociada quedó liberada." });
    void load(false);
  };
  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </AppShell>
    );
  }

  if (!inv) {
    return (
      <AppShell>
        <div className="px-4 py-12 text-center text-sm text-muted-foreground">
          No encontramos esta invitación.
        </div>
      </AppShell>
    );
  }

  const isAccepted = inv.status === "accepted";
  const hasBooking = !!inv.booking_id;

  return (
    <AppShell>
      <div className="space-y-4 px-4 pb-10 pt-2">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Volver
        </button>

        {/* Hero: vs */}
        <div className="rounded-3xl border border-border bg-gradient-to-br from-primary/10 via-card to-card p-5 text-center">
          <Trophy className="mx-auto mb-2 h-6 w-6 text-primary" />
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Partner match
          </p>
          <div className="mt-3 flex items-center justify-center gap-3">
            <div className="flex flex-col items-center gap-1.5">
              <Avatar className="h-14 w-14 ring-2 ring-background">
                <AvatarFallback>
                  {initials(user?.user_metadata?.first_name as string, user?.user_metadata?.last_name as string)}
                </AvatarFallback>
              </Avatar>
              <span className="font-display text-xs">Tú</span>
            </div>
            <span className="font-display text-2xl font-semibold text-primary">vs</span>
            <div className="flex flex-col items-center gap-1.5">
              <Avatar className="h-14 w-14 ring-2 ring-background">
                <AvatarImage src={counterpart?.avatar_url ?? undefined} />
                <AvatarFallback>
                  {initials(counterpart?.first_name, counterpart?.last_name)}
                </AvatarFallback>
              </Avatar>
              <span className="font-display text-xs">
                {counterpart?.first_name ?? "Rival"}
              </span>
            </div>
          </div>
          <Badge
            variant="outline"
            className={cn(
              "mt-4",
              isAccepted ? "border-success/40 text-success" : "border-warning/40 text-warning",
            )}
          >
            {isAccepted ? "Aceptado" : inv.status}
          </Badge>
        </div>

        {/* Horario */}
        {startsAtDate && (
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Horario acordado
            </p>
            <div className="mt-2 flex items-center gap-2 font-display text-base">
              <Clock className="h-4 w-4 text-primary" />
              {format(startsAtDate, "EEEE d 'de' MMMM · HH:mm 'h'", { locale: es })}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Duración estimada: 90 minutos</p>
          </div>
        )}

        {/* Modo externo: el partido se reserva en EasyCancha */}
        {isExternal && isAccepted && startsAtDate && startsAtDate >= new Date() && (
          <div className="space-y-3 rounded-2xl border border-primary/30 bg-primary/5 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Reserva la cancha
            </p>
            <p className="text-xs text-muted-foreground">{EXTERNAL_BOOKING_COPY.banner}</p>
            <ExternalBookingCTA
              source="detail"
              matchKind="partner_invitation"
              refId={inv.id}
              fullWidth
            />
          </div>
        )}

        {/* Auto-reservando (interno) */}
        {!isExternal && isAccepted && !hasBooking && !autoBookError && submitting && (
          <div className="flex items-center gap-2 rounded-2xl border border-border bg-card p-4 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            Reservando cancha automáticamente…
          </div>
        )}

        {/* Cancha (fallback manual si auto-reserva falló o no hay cancha libre inicial) — sólo antes del horario */}
        {!isExternal && isAccepted && !hasBooking && startsAtDate && startsAtDate >= new Date() && (autoBookError || (!submitting && courts.length > 0 && courts.every(c => busyCourtIds.has(c.id)))) && (
          <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Elige cancha y confirma
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {autoBookError ? "La reserva automática no fue posible. Selecciona una cancha." : `Reservaremos a tu nombre con ${counterpart?.first_name} como compañero.`}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {courts.map((c) => {
                const busy = busyCourtIds.has(c.id);
                const active = selectedCourtId === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    disabled={busy}
                    onClick={() => setSelectedCourtId(c.id)}
                    className={cn(
                      "rounded-xl border p-3 text-left text-xs transition-smooth",
                      busy
                        ? "border-border bg-muted/40 text-muted-foreground/50 line-through"
                        : active
                          ? "border-primary bg-primary/10 text-primary shadow-clay"
                          : "border-border bg-background hover:border-primary/40",
                    )}
                  >
                    <div className="flex items-center gap-1.5 font-semibold">
                      <MapPin className="h-3 w-3" />
                      {c.name}
                    </div>
                    <p className="mt-0.5 text-[10px] uppercase tracking-wide opacity-70">
                      {c.surface}
                    </p>
                    {busy && <p className="mt-1 text-[10px]">Ocupada</p>}
                  </button>
                );
              })}
            </div>
            {courts.length > 0 && busyCourtIds.size === courts.length && (
              <p className="rounded-xl border border-dashed border-border bg-muted/30 p-3 text-center text-xs text-muted-foreground">
                Todas las canchas están ocupadas a esa hora. Coordinen otro horario.
              </p>
            )}
            <Button
              variant="clay"
              className="w-full"
              disabled={!selectedCourtId || submitting}
              onClick={confirmBooking}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <CalendarCheck className="mr-2 h-4 w-4" /> Confirmar reserva
                </>
              )}
            </Button>
          </div>
        )}

        {/* Reservado */}
        {hasBooking && startsAtDate && endsAtDate && (
          <div className="space-y-3 rounded-2xl border border-success/40 bg-success/5 p-4">
            <div className="flex items-center gap-2 text-success">
              <CalendarCheck className="h-5 w-5" />
              <p className="font-display text-sm font-semibold">Reserva confirmada</p>
            </div>
            <p className="text-xs text-muted-foreground">
              La cancha quedó reservada a tu nombre. La encuentras en Mis Reservas.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button asChild variant="outline" size="sm" className="flex-1">
                <Link to="/mis-reservas">Ver mis reservas</Link>
              </Button>
              <AddToCalendarButton
                title={`Tenis vs ${counterpart?.first_name ?? ""}`}
                startsAt={startsAtDate}
                endsAt={endsAtDate}
                description={inv.message ?? "Partner match"}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="ghost" size="sm" onClick={openReschedule}>
                <CalendarClock className="mr-2 h-4 w-4" /> Reprogramar
              </Button>
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setCancelOpen(true)}>
                <XCircle className="mr-2 h-4 w-4" /> Cancelar
              </Button>
            </div>
          </div>
        )}

        {/* Cargar / Confirmar resultado del amistoso (sólo después del horario) */}
        {isAccepted && startsAtDate && startsAtDate < new Date() && (() => {
          const meId = user?.id ?? "";
          const oppName = counterpart?.first_name ?? "Rival";
          const oppId = counterpart?.user_id ?? "";

          if (!partnerResult || partnerResult.status === "rechazado") {
            return (
              <div className="space-y-2 rounded-2xl border border-warning/40 bg-warning/5 p-4">
                <div className="flex items-center gap-2 text-warning">
                  <Trophy className="h-4 w-4" />
                  <p className="font-display text-sm font-semibold">Cargar resultado</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  El partido ya se jugó. Carga el resultado y {oppName} deberá confirmarlo. Los amistosos afectan el rating con un peso menor que torneos y Escalerilla.
                </p>
                {partnerResult?.status === "rechazado" && partnerResult.reject_reason && (
                  <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-2 text-[11px] text-destructive">
                    Rechazado anteriormente: {partnerResult.reject_reason}
                  </p>
                )}
                <Button variant="clay" className="w-full" onClick={() => setResultDialogOpen(true)} disabled={!oppId}>
                  <Trophy className="mr-2 h-4 w-4" /> Cargar resultado
                </Button>
              </div>
            );
          }

          if (partnerResult.status === "confirmado") {
            const iWon = partnerResult.winner_user_id === meId;
            const score = partnerResult.score as Array<[number, number]> | null;
            return (
              <div className="space-y-2 rounded-2xl border border-success/40 bg-success/5 p-4">
                <div className="flex items-center gap-2 text-success">
                  <Trophy className="h-4 w-4" />
                  <p className="font-display text-sm font-semibold">Resultado confirmado</p>
                </div>
                <p className="text-xs">
                  {iWon ? `Ganaste a ${oppName}` : `${oppName} te ganó`}
                  {partnerResult.walkover && " · W.O."}
                  {partnerResult.retired && " · Retiro"}
                </p>
                {Array.isArray(score) && score.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Score: {score.map((s) => `${s[0]}-${s[1]}`).join(" ")}
                  </p>
                )}
              </div>
            );
          }

          const iProposed = partnerResult.proposed_by === meId;
          const score = partnerResult.score as Array<[number, number]> | null;
          const winnerLabel = partnerResult.winner_user_id === meId ? "Tú" : oppName;
          return (
            <div className="space-y-2 rounded-2xl border border-warning/40 bg-warning/5 p-4">
              <div className="flex items-center gap-2 text-warning">
                <Trophy className="h-4 w-4" />
                <p className="font-display text-sm font-semibold">
                  {iProposed ? "Esperando confirmación" : "Confirma el resultado"}
                </p>
              </div>
              <p className="text-xs">
                Ganador propuesto: <strong>{winnerLabel}</strong>
                {partnerResult.walkover && " · W.O."}
                {partnerResult.retired && " · Retiro"}
              </p>
              {Array.isArray(score) && score.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Score: {score.map((s) => `${s[0]}-${s[1]}`).join(" ")}
                </p>
              )}
              {iProposed ? (
                <Button variant="outline" size="sm" className="w-full" onClick={() => setResultDialogOpen(true)}>
                  Corregir resultado
                </Button>
              ) : (
                <div className="flex gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    disabled={resultBusy}
                    onClick={async () => {
                      setResultBusy(true);
                      const { error } = await supabase.rpc("reject_partner_match_result", {
                        _invitation_id: inv.id,
                        _reason: "Resultado incorrecto",
                      });
                      setResultBusy(false);
                      if (error) {
                        toast({ title: "No se pudo rechazar", description: error.message, variant: "destructive" });
                        return;
                      }
                      toast({ title: "Resultado rechazado" });
                      void qc.invalidateQueries({ queryKey: ["partner-pending-results"] });
                      void load(false);
                    }}
                  >
                    <X className="mr-1 h-3.5 w-3.5" /> Rechazar
                  </Button>
                  <Button
                    variant="clay"
                    size="sm"
                    className="flex-1"
                    disabled={resultBusy}
                    onClick={async () => {
                      setResultBusy(true);
                      const { error } = await supabase.rpc("confirm_partner_match_result", {
                        _invitation_id: inv.id,
                      });
                      setResultBusy(false);
                      if (error) {
                        toast({ title: "No se pudo confirmar", description: error.message, variant: "destructive" });
                        return;
                      }
                      toast({ title: "Resultado confirmado", description: "Tu rating se actualizó." });
                      void qc.invalidateQueries({ queryKey: ["partner-pending-results"] });
                      void load(false);
                    }}
                  >
                    <Check className="mr-1 h-3.5 w-3.5" /> Confirmar
                  </Button>
                </div>
              )}
            </div>
          );
        })()}

        {!isAccepted && (() => {
          const STATE: Record<string, { title: string; desc: string; tone: string }> = {
            pending: {
              title: "Invitación pendiente",
              desc: "Aún no se ha aceptado. Cuando se acepte podrás confirmar la cancha aquí.",
              tone: "border-warning/40 bg-warning/5 text-warning",
            },
            rejected: {
              title: "Invitación rechazada",
              desc: "El partido no se concretó. Puedes invitar a otro jugador desde Buscar.",
              tone: "border-destructive/40 bg-destructive/5 text-destructive",
            },
            expired: {
              title: "Invitación expirada",
              desc: "La invitación venció sin respuesta. Crea una nueva desde Buscar.",
              tone: "border-muted bg-muted/20 text-muted-foreground",
            },
            cancelled: {
              title: "Invitación cancelada",
              desc: "Esta invitación fue cancelada. Puedes crear una nueva desde Buscar.",
              tone: "border-muted bg-muted/20 text-muted-foreground",
            },
          };
          const s = STATE[inv.status] ?? STATE.pending;
          return (
            <div className={cn("space-y-3 rounded-2xl border p-4", s.tone)}>
              <p className="font-display text-sm font-semibold">{s.title}</p>
              <p className="text-xs opacity-90">{s.desc}</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button asChild variant="outline" size="sm" className="flex-1">
                  <Link to="/ranking?tab=buscar">Volver a Buscar</Link>
                </Button>
              </div>
            </div>
          );
        })()}

        {/* Historial del match */}
        {timeline.length > 0 && (
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" />
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Historial del match
              </p>
            </div>
            <ol className="relative space-y-3 border-l border-border pl-4">
              {timeline.map((ev, idx) => (
                <li key={`${ev.ts}-${idx}`} className="relative">
                  <span className="absolute -left-[1.30rem] top-1 h-2 w-2 rounded-full bg-primary ring-2 ring-card" />
                  <p className="font-display text-xs font-semibold text-foreground">{ev.title}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {format(new Date(ev.ts), "EEE d MMM · HH:mm 'h'", { locale: es })}
                  </p>
                  {ev.desc && (
                    <p className="mt-0.5 text-[11px] text-muted-foreground/90">{ev.desc}</p>
                  )}
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>

      <Dialog open={rescheduleOpen} onOpenChange={setRescheduleOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reprogramar match</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-xs text-muted-foreground">
              Liberaremos la cancha actual y reservaremos el nuevo horario. Si hay choques, te avisaremos.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="rs-dt" className="text-xs">Nueva fecha y hora</Label>
              <Input
                id="rs-dt"
                type="datetime-local"
                value={rescheduleDateTime}
                onChange={(e) => setRescheduleDateTime(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Cancha</Label>
              <div className="grid grid-cols-2 gap-2">
                {courts.map((c) => {
                  const active = rescheduleCourtId === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setRescheduleCourtId(c.id)}
                      className={cn(
                        "rounded-xl border p-2.5 text-left text-xs transition-smooth",
                        active
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-background hover:border-primary/40",
                      )}
                    >
                      <div className="flex items-center gap-1.5 font-semibold">
                        <MapPin className="h-3 w-3" />
                        {c.name}
                      </div>
                      <p className="mt-0.5 text-[10px] uppercase tracking-wide opacity-70">{c.surface}</p>
                    </button>
                  );
                })}
              </div>
              {courts.length === 0 && (
                <p className="text-[11px] text-muted-foreground">No hay canchas disponibles para mostrar.</p>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setRescheduleOpen(false)} disabled={rescheduling}>
              Cancelar
            </Button>
            <Button
              variant="clay"
              onClick={submitReschedule}
              disabled={rescheduling || !rescheduleCourtId || !rescheduleDateTime}
            >
              {rescheduling ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar reprogramación"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelOpen} onOpenChange={(o) => { if (!cancelling) setCancelOpen(o); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>¿Cancelar el match?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-xs text-muted-foreground">
              Se liberará la cancha reservada y la invitación quedará marcada como cancelada en el historial. Esta acción no se puede deshacer.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="cancel-reason" className="text-xs">Motivo (opcional)</Label>
              <Textarea
                id="cancel-reason"
                placeholder="Ej: lesión, viaje, conflicto de horario…"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setCancelOpen(false)} disabled={cancelling}>
              Volver
            </Button>
            <Button variant="destructive" onClick={submitCancel} disabled={cancelling}>
              {cancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cancelar match"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {inv && counterpart && user && (
        <PartnerMatchResultWizard
          open={resultDialogOpen}
          onOpenChange={setResultDialogOpen}
          invitationId={inv.id}
          meId={user.id}
          meName={(user.user_metadata?.first_name as string) ?? "Tú"}
          opponentId={counterpart.user_id}
          opponentName={counterpart.first_name ?? "Rival"}
          opponentAvatarUrl={counterpart.avatar_url ?? null}
          onSubmitted={() => {
            void qc.invalidateQueries({ queryKey: ["partner-pending-results"] });
            void load(false);
          }}
        />
      )}
    </AppShell>
  );
}
