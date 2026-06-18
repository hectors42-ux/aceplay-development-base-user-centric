import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import { useBookingsProvider } from "@/hooks/useBookingsProvider";

export interface UpcomingBookingRow {
  id: string;
  starts_at: string;
  ends_at: string;
  kind: "socio" | "clase" | "torneo";
  court_name: string | null;
  court_surface: string | null;
  other_first_name: string | null;
  other_last_name: string | null;
  i_am_owner: boolean;
}

/**
 * Hook compartido entre el link del Home y la página /mis-reservas.
 * Misma queryKey → un solo fetch sirve a ambos.
 *
 * En modo reservas externas el RPC se salta: no hay reservas internas que
 * mostrar y queremos evitar el round-trip.
 */
export function useMyUpcomingBookings(limit = 50) {
  const { user } = useAuth();
  const { isExternal } = useBookingsProvider();
  return useQuery<UpcomingBookingRow[]>({
    queryKey: ["my-upcoming-bookings", limit, isExternal],
    enabled: !!user && !isExternal,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_upcoming_bookings", { _limit: limit });
      if (error) throw error;
      return ((data ?? []) as unknown) as UpcomingBookingRow[];
    },
  });
}

/**
 * Link minimalista para el Home: "Ver mis próximas reservas (N) →".
 * Se oculta cuando no hay próximas (HeroCard ya cubre el caso "Reservar ahora").
 */
export const UpcomingBookingsLink = () => {
  const { isExternal } = useBookingsProvider();
  const { data, isLoading } = useMyUpcomingBookings(50);
  const bookings = data ?? [];
  const total = bookings.length;
  const tournamentCount = bookings.filter((b) => b.kind === "torneo").length;

  // Modo reservas externas: no aplica.
  if (isExternal) return null;
  // Mostrar si hay 2+ reservas, o si hay alguna reserva de torneo (sin tope).
  // Con 1 sola reserva no-torneo, el HeroCard ya la muestra → evitamos redundancia.
  if (isLoading || total === 0) return null;
  if (total === 1 && tournamentCount === 0) return null;

  return (
    <section className="px-5">
      <Link
        to="/mis-reservas"
        aria-label={`Ver mis próximas reservas (${total})`}
        className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-card transition-smooth hover:border-primary/40 hover:bg-muted/40"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <CalendarDays className="h-4 w-4" strokeWidth={2.2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">Mis próximas reservas</p>
          <p className="text-[11px] text-muted-foreground">
            {total === 1 ? "1 reserva activa" : `${total} reservas activas`}
          </p>
        </div>
        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={2.2} />
      </Link>
    </section>
  );
};
