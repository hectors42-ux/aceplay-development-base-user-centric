import { HeroRouter } from "@/components/home/HeroRouter";

/**
 * Hero principal del Home. Selecciona variante (reserva próxima, torneo,
 * MOTW, sugerencia o idle) según el contexto del usuario y el proveedor
 * de reservas configurado por el club.
 *
 * El render real vive en HeroRouter para mantener este wrapper estable
 * frente a cualquier import existente.
 */
export const HeroCard = () => <HeroRouter />;
