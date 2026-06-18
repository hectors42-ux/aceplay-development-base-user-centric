/**
 * Copy unificado para el modo de reservas externo (proveedor = EasyCancha).
 * Único punto de verdad para tono y mensajes mostrados al usuario en
 * diálogos, banners, CTAs y avisos relacionados.
 *
 * Tono: directo, en segunda persona, sin tecnicismos. Siempre nombrar
 * "EasyCancha" como el lugar donde se reserva la cancha.
 */

export const EXTERNAL_PROVIDER_NAME = "EasyCancha";

export const EXTERNAL_BOOKING_COPY = {
  /** Texto del botón / CTA que abre el proveedor externo. */
  cta: "Reservar en EasyCancha",
  /** aria-label para íconos o triggers que solo muestran el ícono. */
  ariaOpen: "Abrir EasyCancha en una pestaña nueva",
  /** Banner corto reutilizable dentro de diálogos y hero. */
  banner:
    "Este club gestiona las reservas en EasyCancha. Aquí coordinas el horario; la cancha la reservas tú en EasyCancha.",
  /** Aviso para coordinar partidos de ladder (jugador acepta slot). */
  ladderDescription:
    "Tu rival propuso 3 horarios. Al confirmar acuerdan el horario; la cancha se reserva aparte en EasyCancha.",
  /** Aviso para programar partidos de torneo (admin). */
  tournamentDescription:
    "Aquí queda registrado el horario del partido. La cancha se reserva aparte en EasyCancha.",
  /** Recordatorio dentro del flujo admin de torneos. */
  tournamentReminder:
    "Esta programación no bloquea la cancha en EasyCancha. Recuerda reservarla allí también.",
  /** Toast al activar modo externo desde Admin · Canchas. */
  adminToastEnabled: "Las reservas ahora se gestionan en EasyCancha",
  /** Toast al volver al modo interno. */
  adminToastDisabled: "Las reservas vuelven a gestionarse en AcePlay",
} as const;
