
export type RatingSport = "tenis_singles" | "tenis_dobles" | "padel" | "pickleball";

export const RATING_SPORT_LABEL: Record<RatingSport, string> = {
  tenis_singles: "Tenis Singles",
  tenis_dobles: "Tenis Dobles",
  padel: "Pádel",
  pickleball: "Pickleball",
};

/**
 * Bandas de nivel estilo Playtomic (0–7).
 */
export interface LevelBand {
  min: number;
  max: number;
  label: string;
  short: string;
  color: string; // tailwind text color class (semantic token recomendado)
  description: string;
}

export const LEVEL_BANDS: LevelBand[] = [
  {
    min: 0,
    max: 0.99,
    label: "Iniciación",
    short: "Inic.",
    color: "text-muted-foreground",
    description: "Sin experiencia o muy poca. Estás aprendiendo a tomar la raqueta.",
  },
  {
    min: 1.0,
    max: 1.49,
    label: "Principiante",
    short: "Princ.",
    color: "text-muted-foreground",
    description: "Conoces las bases pero te cuesta sostener peloteos.",
  },
  {
    min: 1.5,
    max: 2.49,
    label: "Inic. intermedio",
    short: "Int. bajo",
    color: "text-accent",
    description: "Sostienes peloteos cortos. Sirves con dificultad.",
  },
  {
    min: 2.5,
    max: 3.49,
    label: "Intermedio",
    short: "Int.",
    color: "text-accent",
    description: "Controlas direcciones básicas y entiendes táctica simple.",
  },
  {
    min: 3.5,
    max: 4.49,
    label: "Intermedio alto",
    short: "Int. alto",
    color: "text-primary",
    description: "Buen control, juegas estrategia y variantes.",
  },
  {
    min: 4.5,
    max: 5.39,
    label: "Intermedio avanzado",
    short: "Int. avz.",
    color: "text-primary",
    description: "Alternas ataque y defensa con criterio. Nivel de torneo local.",
  },
  {
    min: 5.4,
    max: 7.0,
    label: "Competición",
    short: "Comp.",
    color: "text-success",
    description: "Nivel competitivo, juegas torneos federados.",
  },
];

export const getLevelBand = (level: number): LevelBand => {
  return LEVEL_BANDS.find((b) => level >= b.min && level <= b.max) ?? LEVEL_BANDS[0];
};

/**
 * Formato display de nivel: 3.42 con dos decimales.
 */
export const formatLevel = (level: number | null | undefined): string => {
  if (level === null || level === undefined) return "—";
  return level.toFixed(2);
};

/**
 * Formato delta con signo y color.
 */
export const formatDelta = (delta: number): string => {
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toFixed(2)}`;
};

export const getDeltaColor = (delta: number): string => {
  if (delta > 0) return "text-success";
  if (delta < 0) return "text-destructive";
  return "text-muted-foreground";
};

/**
 * Etiqueta de la fiabilidad (reliability %).
 */
export const getReliabilityLabel = (reliability: number): string => {
  if (reliability >= 85) return "Muy alta";
  if (reliability >= 70) return "Alta";
  if (reliability >= 50) return "Media";
  if (reliability >= 30) return "Baja";
  return "Muy baja";
};

export const getReliabilityHint = (reliability: number): string => {
  if (reliability >= 85)
    return "El sistema conoce muy bien tu nivel. Cambios pequeños tras cada partido.";
  if (reliability >= 70)
    return "Tu nivel está bien estimado. Los partidos lo afinan poco a poco.";
  if (reliability >= 50)
    return "Estimación razonable. Sigue jugando competitivos para confirmarla.";
  if (reliability >= 30)
    return "Aún calibrando. Cada partido puede mover bastante tu nivel.";
  return "El sistema todavía está aprendiendo tu nivel real. Cambios grandes esperables.";
};

/* ------------------------------------------------------------------
 * Onboarding: cálculo de nivel inicial a partir del cuestionario
 * ------------------------------------------------------------------ */

export interface OnboardingAnswers {
  experience: "none" | "less_1" | "1_3" | "3_5" | "5_10" | "more_10";
  frequency: "rare" | "monthly" | "weekly" | "multi_week" | "daily";
  background: "none" | "club_classes" | "amateur_tournaments" | "federated" | "ex_competitor";
  rallies: "few" | "10_20" | "20_50" | "50_plus";
  serve: "none" | "in_court" | "directed" | "powerful";
  selfRating: "beginner" | "low_inter" | "inter" | "high_inter" | "advanced" | "competitive";
  lastTournament: "never" | "internal" | "local" | "regional" | "national";
}

const SCORES: Record<keyof OnboardingAnswers, Record<string, number>> = {
  experience: { none: 0.0, less_1: 0.5, "1_3": 1.5, "3_5": 2.5, "5_10": 3.5, more_10: 4.2 },
  frequency: { rare: 0.0, monthly: 0.3, weekly: 0.8, multi_week: 1.2, daily: 1.5 },
  background: {
    none: 0.0,
    club_classes: 0.5,
    amateur_tournaments: 1.2,
    federated: 1.8,
    ex_competitor: 2.2,
  },
  rallies: { few: 0.2, "10_20": 1.0, "20_50": 2.0, "50_plus": 2.8 },
  serve: { none: 0.0, in_court: 0.8, directed: 1.6, powerful: 2.4 },
  selfRating: {
    beginner: 1.2,
    low_inter: 2.2,
    inter: 3.0,
    high_inter: 3.8,
    advanced: 4.6,
    competitive: 5.4,
  },
  lastTournament: { never: 0.0, internal: 0.4, local: 1.0, regional: 1.6, national: 2.2 },
};

const WEIGHTS: Record<keyof OnboardingAnswers, number> = {
  experience: 0.18,
  frequency: 0.1,
  background: 0.16,
  rallies: 0.14,
  serve: 0.12,
  selfRating: 0.22,
  lastTournament: 0.08,
};

/**
 * Calcula nivel inicial 0–7 a partir de respuestas y devuelve también la fiabilidad inicial sugerida.
 */
export const computeInitialLevel = (
  answers: OnboardingAnswers,
): { level: number; reliability: number } => {
  let weighted = 0;
  for (const key of Object.keys(answers) as (keyof OnboardingAnswers)[]) {
    const score = SCORES[key][answers[key]] ?? 0;
    weighted += score * WEIGHTS[key];
  }
  // Normalizamos al rango 0–7. La suma máxima ponderada ~ 3.6, escalamos.
  const raw = (weighted / 3.6) * 7;
  const level = Math.max(0, Math.min(7, Number(raw.toFixed(2))));

  // Reliability inicial: más alta si responde con consistencia (auto-rating cercano al cálculo).
  const reliability = 15;
  return { level, reliability };
};

/**
 * Tipo plantilla para insertar en BD a futuro (queda como referencia).
 */
export type PlayerRatingRow = {
  id: string;
  user_id: string;
  tenant_id: string;
  sport: RatingSport;
  level: number;
  reliability: number;
  initial_level: number | null;
  matches_played: number;
  competitive_matches: number;
  last_match_at: string | null;
  last_change_delta: number;
  onboarding_completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type RatingHistoryRow = {
  id: string;
  user_id: string;
  tenant_id: string;
  sport: RatingSport;
  level_before: number;
  level_after: number;
  delta: number;
  reliability_before: number;
  reliability_after: number;
  source: string /* TODO: cablear fase 2 */;
  source_ref_id: string | null;
  notes: string | null;
  recorded_at: string;
};
