/**
 * PRD 11 · Catálogo central de templates de push / notificaciones in-app.
 *
 * Reglas de copy editorial AcePlay:
 *  - Voseo cuando el sentimiento es alto ("Sumaste", "Ganaste"); usted/neutral cuando es informativo.
 *  - Sin emojis salvo 🔥 (`streak_started`) y 🏆 (`tournament_champion`).
 *  - Frases cortas. Máximo 2 oraciones. iOS/Android truncan a ~60 chars el body.
 *  - Un solo signo de exclamación como mucho.
 *  - Acción al final: "→ Ver", "→ Revisar", "→ Compartir".
 *  - Personalización: nombre + número (ronda, score, posición).
 *
 * Las inserciones server-side ya stamping `title` y `description` en la tabla
 * `user_notifications`. Este catálogo es la single source of truth para:
 *  1) edge functions Deno (mirror en `supabase/functions/_shared/push-templates.ts`).
 *  2) renders FE de fallback cuando un kind no trae copy custom.
 *  3) docs/push-catalog.md.
 */

export type PushCategory = "juego" | "marketing" | "sistema";

export interface PushTemplate<P = Record<string, unknown>> {
  kind: string;
  category: PushCategory;
  title: (payload: P) => string;
  body: (payload: P) => string;
  deepLink: (payload: P) => string;
}

const t = <P,>(tpl: PushTemplate<P>) => tpl;

/* eslint-disable @typescript-eslint/no-explicit-any */
export const PUSH_TEMPLATES = {
  tournament_drawing_published: t<{ slug: string; category_id: string }>({
    kind: "tournament_drawing_published",
    category: "juego",
    title: () => "El sorteo está",
    body: () => "Mirá con quién jugás. → Ver",
    deepLink: (p) => `/torneos/${p.slug}/cat/${p.category_id}`,
  }),

  partner_changed: t<{ slug: string; category_id: string; round_n: number }>({
    kind: "partner_changed",
    category: "juego",
    title: () => "Tu pareja cambió",
    body: (p) => `Para la ronda ${p.round_n}. → Ver detalle`,
    deepLink: (p) => `/torneos/${p.slug}/cat/${p.category_id}`,
  }),

  your_match_in_10: t<{ slug: string; category_id: string; court: string; partner_name: string }>({
    kind: "your_match_in_10",
    category: "juego",
    title: () => "Tu match arranca en 10",
    body: (p) => `Cancha ${p.court} en 10 min. Tu pareja: ${p.partner_name}.`,
    deepLink: (p) => `/torneos/${p.slug}/cat/${p.category_id}`,
  }),

  round_started: t<{ slug: string; category_id: string; round_n: number }>({
    kind: "round_started",
    category: "juego",
    title: (p) => `Ronda ${p.round_n} arrancó`,
    body: () => "Suerte. → Ver",
    deepLink: (p) => `/torneos/${p.slug}/cat/${p.category_id}`,
  }),

  result_pending_confirmation: t<{
    slug: string;
    category_id: string;
    reporter_name: string;
    score: string;
  }>({
    kind: "result_pending_confirmation",
    category: "juego",
    title: () => "Resultado por confirmar",
    body: (p) => `${p.reporter_name} cargó ${p.score}. Confirmá o disputá. → Revisar`,
    deepLink: (p) => `/torneos/${p.slug}/cat/${p.category_id}`,
  }),

  match_disputed: t<{ slug: string; category_id: string; player_name: string; court: string }>({
    kind: "match_disputed",
    category: "juego",
    title: () => "Resultado disputado",
    body: (p) => `${p.player_name} disputó la cancha ${p.court}. → Revisar`,
    deepLink: (p) => `/torneos/${p.slug}/operar`,
  }),

  result_auto_confirmed: t<{ slug: string; category_id: string }>({
    kind: "result_auto_confirmed",
    category: "juego",
    title: () => "Resultado confirmado",
    body: () => "Se confirmó automáticamente. → Ver",
    deepLink: (p) => `/torneos/${p.slug}/cat/${p.category_id}`,
  }),

  you_won_match: t<{ slug: string; category_id: string; points: number; pos: number }>({
    kind: "you_won_match",
    category: "juego",
    title: () => "Ganaste",
    body: (p) => `Sumaste ${p.points}. Vas ${p.pos}º. → Ver tabla`,
    deepLink: (p) => `/torneos/${p.slug}/cat/${p.category_id}`,
  }),

  streak_started: t<{ slug: string; category_id: string }>({
    kind: "streak_started",
    category: "juego",
    title: () => "🔥 Tres seguidas",
    body: () => "Compartí el momento. → Ver tarjeta",
    deepLink: (p) => `/torneos/${p.slug}/cat/${p.category_id}`,
  }),

  climbed_positions: t<{ slug: string; category_id: string; n: number; pos: number }>({
    kind: "climbed_positions",
    category: "juego",
    title: () => "Subiste en la tabla",
    body: (p) => `Subiste ${p.n} puestos. Estás ${p.pos}º. → Ver`,
    deepLink: (p) => `/torneos/${p.slug}/cat/${p.category_id}`,
  }),

  session_ended_share_day: t<{ slug: string; category_id: string }>({
    kind: "session_ended_share_day",
    category: "juego",
    title: () => "Cerraste tu día",
    body: () => "Mirá tu tarjeta de cierre. → Ver",
    deepLink: (p) => `/torneos/${p.slug}/cat/${p.category_id}`,
  }),

  tournament_champion: t<{ slug: string; category_id: string }>({
    kind: "tournament_champion",
    category: "juego",
    title: () => "🏆 Sos campeón",
    body: () => "Tu tarjeta WOW te espera. → Ver",
    deepLink: (p) => `/torneos/${p.slug}/cat/${p.category_id}`,
  }),

  tournament_ended: t<{ slug: string }>({
    kind: "tournament_ended",
    category: "juego",
    title: () => "El torneo cerró",
    body: () => "Mirá la tabla final. → Ver",
    deepLink: (p) => `/torneos/${p.slug}`,
  }),

  trial_ending: t<{ days: number }>({
    kind: "trial_ending",
    category: "marketing",
    title: () => "Tu trial termina pronto",
    body: (p) => `Te quedan ${p.days} días en el club. → Renová`,
    deepLink: () => `/perfil`,
  }),

  operator_assigned: t<{ slug: string; tournament_name: string }>({
    kind: "operator_assigned",
    category: "sistema",
    title: () => "Sos operador",
    body: (p) => `Del torneo ${p.tournament_name}. → Entrar`,
    deepLink: (p) => `/torneos/${p.slug}/operar`,
  }),
} as const satisfies Record<string, PushTemplate<any>>;
/* eslint-enable @typescript-eslint/no-explicit-any */

export type PushKind = keyof typeof PUSH_TEMPLATES;

export const PUSH_CATEGORY_LABEL: Record<PushCategory, string> = {
  juego: "Juego",
  marketing: "Marketing",
  sistema: "Sistema",
};