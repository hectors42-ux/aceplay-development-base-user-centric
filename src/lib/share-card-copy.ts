/**
 * Copies y helpers para los títulos auto-generados de las share cards.
 */

const STREAK_TITLES = [
  "Imparable",
  "Sube como espuma",
  "El partido era pa' ti",
  "Modo on",
];

const CLIMB_TITLES = [
  "Saltó al top",
  "Tres escalones de un tirón",
  "Ranking en llamas",
];

export function streakTitle(seed: number) {
  return STREAK_TITLES[seed % STREAK_TITLES.length];
}

export function climbTitle(seed: number) {
  return CLIMB_TITLES[seed % CLIMB_TITLES.length];
}

export function fullName(first?: string | null, last?: string | null) {
  return [first, last].filter(Boolean).join(" ").trim() || "Jugador";
}

export function handleFor(first?: string | null, last?: string | null) {
  const base = [first, last].filter(Boolean).join("").toLowerCase();
  return base ? `@${base}` : "@aceplay";
}

export function buildShareUrl(slug: string, kind: string, userId?: string | null) {
  const params = new URLSearchParams({ kind });
  if (userId) params.set("userId", userId);
  return `${window.location.origin}/torneos/${slug}/compartir?${params.toString()}`;
}

export function buildInviteLink(slug: string) {
  return `${window.location.host}/torneos/${slug}`;
}