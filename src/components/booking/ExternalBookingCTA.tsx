import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBookingsProvider, openExternalBooking } from "@/hooks/useBookingsProvider";
import { EXTERNAL_BOOKING_COPY } from "@/lib/external-bookings-copy";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  source: "card" | "sheet" | "hero" | "detail";
  matchKind: string;
  refId: string;
  className?: string;
  size?: "sm" | "default" | "lg";
  variant?: "clay" | "outline" | "ghost";
  fullWidth?: boolean;
}

/**
 * CTA "Reservar en EasyCancha" — solo renderiza si el club tiene
 * configurado modo externo. Encapsula tracking + apertura segura.
 */
export const ExternalBookingCTA = ({
  source,
  matchKind,
  refId,
  className,
  size = "sm",
  variant = "clay",
  fullWidth,
}: Props) => {
  const { isExternal, externalUrl } = useBookingsProvider();
  if (!isExternal) return null;
  return (
    <Button
      size={size}
      variant={variant}
      className={`${fullWidth ? "w-full" : ""} gap-1.5 ${className ?? ""}`}
      onClick={() => {
        openExternalBooking(externalUrl);
        void supabase.from("analytics_events").insert({
          event_name: "external_booking_opened",
          event_props: { source, match_kind: matchKind, ref_id: refId },
        } as never);
      }}
    >
      <ExternalLink className="h-3.5 w-3.5" />
      {EXTERNAL_BOOKING_COPY.cta}
    </Button>
  );
};
