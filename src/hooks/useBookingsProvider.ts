import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";

export type BookingsProvider = "internal" | "external";

interface BookingsProviderRow {
  bookings_provider: BookingsProvider;
  external_booking_url: string | null;
}

/**
 * Flag por tenant: decide si las reservas se gestionan internamente
 * en AcePlay o se delegan a un proveedor externo (ej. EasyCancha).
 * Cache 5 min — cambia con muy baja frecuencia (desde Admin Canchas).
 */
export const useBookingsProvider = () => {
  const { profile } = useAuth();
  const tenantId = profile?.tenant_id ?? null;

  const q = useQuery({
    queryKey: ["bookings-provider", tenantId],
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    queryFn: async (): Promise<BookingsProviderRow> => {
      const { data } = await supabase
        .from("tenants")
        .select("bookings_provider, external_booking_url")
        .eq("id", tenantId!)
        .maybeSingle();
      return {
        bookings_provider: ((data as any)?.bookings_provider ?? "internal") as BookingsProvider,
        external_booking_url: (data as any)?.external_booking_url ?? null,
      };
    },
  });

  const provider: BookingsProvider = q.data?.bookings_provider ?? "internal";
  const externalUrl = q.data?.external_booking_url ?? null;

  return {
    provider,
    externalUrl,
    isExternal: provider === "external",
    isLoading: q.isLoading,
  };
};

/**
 * Abre la URL externa de reservas en pestaña nueva con rel seguro.
 */
export const openExternalBooking = (url: string | null) => {
  if (!url) return;
  window.open(url, "_blank", "noopener,noreferrer");
};
