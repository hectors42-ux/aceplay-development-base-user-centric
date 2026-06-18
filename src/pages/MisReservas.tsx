import { useEffect, useState } from "react";
import { SportBadge } from "@/components/SportBadge";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  ArrowLeft,
  Calendar,
  CalendarPlus,
  Clock,
  MapPin,
  Search,
  User,
  X,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AppShell } from "@/components/AppShell";
import { BottomNav } from "@/components/BottomNav";
import { AddToCalendarButton } from "@/components/shared/AddToCalendarButton";
import { dayLabel } from "@/lib/booking-utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMyUpcomingBookings, type UpcomingBookingRow } from "@/components/UpcomingBookingsLink";
import { useBookingsProvider, openExternalBooking } from "@/hooks/useBookingsProvider";
import { cn } from "@/lib/utils";

const surfaceLabel = (s: string | null) => {
  if (!s) return "—";
  const k = s.toLowerCase();
  if (k.includes("dura") || k.includes("hard")) return "Cancha dura";
  if (k.includes("arcilla") || k.includes("clay") || k.includes("polvo")) return "Arcilla";
  return s;
};

const BookingCard = ({
  booking,
  onCancelled,
}: {
  booking: UpcomingBookingRow;
  onCancelled: () => void;
}) => {
  const [cancelling, setCancelling] = useState(false);
  const start = parseISO(booking.starts_at);
  const end = parseISO(booking.ends_at);
  const partner = booking.other_first_name
    ? `${booking.other_first_name} ${(booking.other_last_name ?? "").charAt(0)}.`
    : null;

  const handleCancel = async () => {
    if (!booking.i_am_owner) return;
    if (!confirm("¿Cancelar esta reserva?")) return;
    setCancelling(true);
    const { error } = await supabase.rpc("cancel_booking", { _booking_id: booking.id });
    setCancelling(false);
    if (error) {
      toast.error("No se pudo cancelar", { description: error.message });
      return;
    }
    toast.success("Reserva cancelada");
    onCancelled();
  };

  return (
    <li
      data-booking-card
      className="rounded-2xl border border-border bg-card p-4 shadow-card"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
              booking.i_am_owner
                ? "bg-success/15 text-success"
                : "bg-primary/15 text-primary",
            )}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {booking.i_am_owner ? "Confirmada" : "Te invitaron"}
          </span>
          <h3 className="mt-2 font-display text-lg font-semibold leading-tight text-foreground">
            {booking.court_name ?? "Cancha"}
          </h3>
          <div className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
            <p className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" strokeWidth={2.2} />
              <span className="capitalize">
                {dayLabel(start)} · {format(start, "d 'de' MMM", { locale: es })}
              </span>
            </p>
            <p className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" strokeWidth={2.2} />
              {format(start, "HH:mm")} — {format(end, "HH:mm")}
            </p>
            <p className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" strokeWidth={2.2} />
              {surfaceLabel(booking.court_surface)}
            </p>
            {partner && (
              <p className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" strokeWidth={2.2} />
                {booking.i_am_owner ? "Con " : "Te invita "}
                {partner}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <AddToCalendarButton
          title={`Reserva · ${booking.court_name ?? "Cancha"}`}
          description={partner ? `Con ${partner}` : undefined}
          location={booking.court_name ?? undefined}
          startsAt={booking.starts_at}
          endsAt={booking.ends_at}
          filename={`reserva-${booking.id}.ics`}
          label="Calendario"
        />
        <Button asChild size="sm" variant="ghost" className="gap-1.5 text-xs">
          <Link to="/reservar" aria-label="Ver agenda de canchas">
            Ver agenda
          </Link>
        </Button>
        {booking.i_am_owner && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={handleCancel}
            disabled={cancelling}
            aria-label="Cancelar reserva"
            className="ml-auto gap-1.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            {cancelling ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <X className="h-3.5 w-3.5" />
            )}
            Cancelar
          </Button>
        )}
      </div>
    </li>
  );
};

const MisReservas = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isExternal, externalUrl, isLoading: providerLoading } = useBookingsProvider();
  const { data, isLoading, error, refetch } = useMyUpcomingBookings(50);

  // Reservas delegadas a proveedor externo: abrir URL y volver al Home.
  useEffect(() => {
    if (!providerLoading && isExternal) {
      openExternalBooking(externalUrl);
    }
  }, [providerLoading, isExternal, externalUrl]);

  // Early return DESPUÉS de todos los hooks para no violar Rules of Hooks.
  if (!providerLoading && isExternal) {
    return <Navigate to="/" replace />;
  }

  const bookings = data ?? [];
  const handleCancelled = () => {
    void qc.invalidateQueries({ queryKey: ["my-upcoming-bookings"] });
  };


  return (
    <AppShell>
      <div className="min-h-screen bg-background pb-28 md:pb-12">
        {/* Header sticky */}
        <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur-md">
          <div className="mx-auto flex max-w-md items-center gap-2 px-4 py-3 lg:max-w-3xl">
            <button
              type="button"
              onClick={() => navigate(-1)}
              aria-label="Volver"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-foreground hover:bg-muted"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-base font-semibold leading-tight">
                Mis reservas
              </h1>
              <p className="text-[11px] text-muted-foreground">
                {isLoading
                  ? "Cargando…"
                  : `${bookings.length} ${bookings.length === 1 ? "reserva" : "reservas"} activa${bookings.length === 1 ? "" : "s"}`}
              </p>
            </div>
            <SportBadge />
            <Button asChild size="sm" variant="outline" className="gap-1.5 text-xs">
              <Link to="/reservar" aria-label="Buscar nueva cancha">
                <Search className="h-3.5 w-3.5" />
                Buscar
              </Link>
            </Button>
          </div>
        </header>

        <main className="mx-auto max-w-md px-4 pt-4 lg:max-w-3xl">
          {isLoading ? (
            <ul className="space-y-3" aria-label="Cargando reservas">
              {Array.from({ length: 3 }).map((_, i) => (
                <li key={i}>
                  <Skeleton className="h-[160px] w-full rounded-2xl" />
                </li>
              ))}
            </ul>
          ) : error ? (
            <div
              role="alert"
              className="flex flex-col items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center"
            >
              <AlertCircle className="h-6 w-6 text-destructive" />
              <p className="text-sm font-medium text-foreground">
                No pudimos cargar tus reservas
              </p>
              <Button size="sm" variant="outline" onClick={() => void refetch()}>
                Reintentar
              </Button>
            </div>
          ) : bookings.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card/60 p-8 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <CalendarPlus className="h-6 w-6" />
              </span>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">Sin reservas activas</p>
                <p className="text-xs text-muted-foreground">
                  Cuando reserves una cancha, la verás aquí.
                </p>
              </div>
              <Button asChild size="sm" variant="default">
                <Link to="/reservar" aria-label="Buscar cancha">
                  <Search className="h-3.5 w-3.5" />
                  Buscar cancha
                </Link>
              </Button>
            </div>
          ) : (
            <ul className="space-y-3" aria-label="Lista de reservas activas">
              {bookings.map((b) => (
                <BookingCard key={b.id} booking={b} onCancelled={handleCancelled} />
              ))}
            </ul>
          )}
        </main>
      </div>
      <BottomNav />
    </AppShell>
  );
};

export default MisReservas;
