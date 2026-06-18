import { ReactNode, MouseEvent } from "react";
import { Link } from "react-router-dom";
import { useBookingsProvider, openExternalBooking } from "@/hooks/useBookingsProvider";
import { EXTERNAL_BOOKING_COPY } from "@/lib/external-bookings-copy";

interface Props {
  to: string;
  className?: string;
  children: ReactNode;
  ariaLabel?: string;
  onClickExtra?: () => void;
}

/**
 * Botón/Link unificado para abrir el flujo de reservas.
 * - Modo interno: navega a `to` (ej. "/reservar").
 * - Modo externo: abre la URL configurada por el admin (ej. EasyCancha) en nueva pestaña.
 *
 * Mantener intacto el aspecto: pasa className y children sin alterar estilos.
 */
export const BookingTrigger = ({ to, className, children, ariaLabel, onClickExtra }: Props) => {
  const { isExternal, externalUrl } = useBookingsProvider();

  if (isExternal) {
    const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
      e.preventDefault();
      openExternalBooking(externalUrl);
      onClickExtra?.();
    };
    return (
      <a
        href={externalUrl ?? "#"}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleClick}
        aria-label={ariaLabel ?? EXTERNAL_BOOKING_COPY.ariaOpen}
        className={className}
      >
        {children}
      </a>
    );
  }

  return (
    <Link to={to} aria-label={ariaLabel} className={className} onClick={() => onClickExtra?.()}>
      {children}
    </Link>
  );
};
