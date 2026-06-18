import type { Database } from "@/integrations/supabase/types";

export type TournamentStatus = Database["public"]["Enums"]["tournament_status"];
export type TournamentDiscipline = Database["public"]["Enums"]["tournament_discipline"];
export type RegistrationStatus = Database["public"]["Enums"]["registration_status"];
export type MatchStatus = Database["public"]["Enums"]["match_status"];
export type CourtSurface = Database["public"]["Enums"]["court_surface"];
export type ResultValidationMode = Database["public"]["Enums"]["result_validation_mode"];
export type CategoryGender = Database["public"]["Enums"]["category_gender"];
export type MatchResultProposalStatus = Database["public"]["Enums"]["match_result_proposal_status"];
export type RescheduleRequestStatus = Database["public"]["Enums"]["reschedule_request_status"];

/**
 * Zona de riesgo en standings (PRD 5 · QA 2.2.1–2.2.4).
 *   - safe:    posición segura
 *   - warning: zona ámbar (4 últimos antes de la cola)
 *   - danger:  zona de cola (últimos 2)
 */
export type RelegationZone = "safe" | "warning" | "danger";

export function getRelegationZone(position: number, total: number): RelegationZone {
  if (!total || total <= 0 || !position || position <= 0) return "safe";
  if (position >= total - 1) return "danger";
  if (position >= total - 4) return "warning";
  return "safe";
}

export const TOURNAMENT_STATUS_LABEL: Record<TournamentStatus, string> = {
  borrador: "Borrador",
  inscripciones_abiertas: "Inscripciones abiertas",
  inscripciones_cerradas: "Inscripciones cerradas",
  en_curso: "En curso",
  finalizado: "Finalizado",
  cancelado: "Cancelado",
};

export const TOURNAMENT_STATUS_TRANSITION_LABEL: Record<TournamentStatus, string> = {
  borrador: "Volver a borrador",
  inscripciones_abiertas: "Abrir inscripciones",
  inscripciones_cerradas: "Cerrar inscripciones",
  en_curso: "Iniciar torneo",
  finalizado: "Finalizar torneo",
  cancelado: "Cancelar torneo",
};

/**
 * Devuelve los próximos estados permitidos para un torneo dado su estado actual.
 * Mantiene la máquina de estados centralizada para evitar inconsistencias.
 */
export function nextAllowedStatuses(current: TournamentStatus): TournamentStatus[] {
  switch (current) {
    case "borrador":
      return ["inscripciones_abiertas", "cancelado"];
    case "inscripciones_abiertas":
      return ["inscripciones_cerradas", "en_curso", "cancelado", "borrador"];
    case "inscripciones_cerradas":
      return ["en_curso", "inscripciones_abiertas", "cancelado"];
    case "en_curso":
      return ["finalizado", "inscripciones_cerradas"];
    case "finalizado":
      return ["en_curso"];
    case "cancelado":
      return ["borrador"];
    default:
      return [];
  }
}

export const DISCIPLINE_LABEL: Record<TournamentDiscipline, string> = {
  tenis_singles: "Tenis singles",
  tenis_dobles: "Tenis dobles",
  padel_dobles: "Pádel dobles",
};

export const REGISTRATION_STATUS_LABEL: Record<RegistrationStatus, string> = {
  pendiente_pareja: "Esperando a pareja",
  pendiente_admin: "Pendiente de aprobación",
  confirmada: "Confirmada",
  rechazada: "Rechazada",
  retirada: "Retirada",
};

export const MATCH_STATUS_LABEL: Record<MatchStatus, string> = {
  pendiente: "Pendiente",
  programado: "Programado",
  jugado: "Jugado",
  walkover: "W.O.",
  cancelado: "Cancelado",
  interrumpido: "Interrumpido",
};

export const SURFACE_LABEL: Record<CourtSurface, string> = {
  arcilla: "Arcilla",
  dura: "Dura",
  cesped: "Césped",
  sintetico: "Sintético",
};

export const GENDER_LABEL: Record<CategoryGender, string> = {
  varones: "Varones",
  damas: "Damas",
  mixto: "Mixto",
};

export const VALIDATION_MODE_LABEL: Record<ResultValidationMode, string> = {
  solo_admin: "Solo el admin carga resultados",
  jugadores_con_confirmacion: "Jugadores cargan, el rival confirma",
  jugadores_con_aprobacion_admin: "Jugadores cargan, admin aprueba",
};

export function tournamentStatusColor(status: TournamentStatus): string {
  switch (status) {
    case "inscripciones_abiertas":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
    case "en_curso":
      return "bg-primary/15 text-primary";
    case "finalizado":
      return "bg-muted text-muted-foreground";
    case "cancelado":
      return "bg-destructive/15 text-destructive";
    case "inscripciones_cerradas":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-400";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function registrationStatusColor(status: RegistrationStatus): string {
  switch (status) {
    case "confirmada":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
    case "pendiente_pareja":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-400";
    case "pendiente_admin":
      return "bg-primary/15 text-primary";
    case "rechazada":
    case "retirada":
      return "bg-destructive/15 text-destructive";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function matchStatusColor(status: MatchStatus): string {
  switch (status) {
    case "jugado":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
    case "programado":
      return "bg-primary/15 text-primary";
    case "walkover":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-400";
    case "cancelado":
      return "bg-destructive/15 text-destructive";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function roundLabel(round: number, totalRounds: number): string {
  if (round === 1) return "Final";
  if (round === 2) return "Semifinal";
  if (round === 3) return "Cuartos de final";
  if (round === 4) return "Octavos";
  if (round === 5) return "16avos";
  if (round === 6) return "32avos";
  return `Ronda ${totalRounds - round + 1}`;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

export type SetScore = {
  a: number;
  b: number;
  tb?: number;
  tb_a?: number;
  tb_b?: number;
  /** PRD 8: marca un set como súper tie-break (10 pts) cuando aplica. */
  kind?: "set" | "super_tb";
};

export function formatScore(score: unknown): string {
  if (!Array.isArray(score)) return "—";
  return (score as SetScore[])
    .map((s) => {
      // Soporta tanto { tb } (perdedor) como { tb_a, tb_b } (ambos lados)
      if (s.tb_a !== undefined && s.tb_b !== undefined) {
        return `${s.a}-${s.b}(${Math.min(s.tb_a, s.tb_b)})`;
      }
      return s.tb !== undefined ? `${s.a}-${s.b}(${s.tb})` : `${s.a}-${s.b}`;
    })
    .join(" / ");
}

export function parseScoreInput(text: string): SetScore[] | null {
  // Acepta "6-4 6-3" o "6-4, 7-6(5), 10-8"
  const sets = text
    .split(/[,\s/]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (sets.length === 0) return null;
  const out: SetScore[] = [];
  for (const s of sets) {
    const m = /^(\d{1,2})-(\d{1,2})(?:\((\d{1,2})\))?$/.exec(s);
    if (!m) return null;
    const a = Number(m[1]);
    const b = Number(m[2]);
    const tb = m[3] !== undefined ? Number(m[3]) : undefined;
    out.push(tb !== undefined ? { a, b, tb } : { a, b });
  }
  return out;
}

export function inferWinnerFromScore(
  score: SetScore[],
  regAId: string | null,
  regBId: string | null,
): string | null {
  if (!regAId || !regBId) return null;
  let aSets = 0;
  let bSets = 0;
  for (const s of score) {
    if (s.a > s.b) aSets++;
    else if (s.b > s.a) bSets++;
  }
  if (aSets === bSets) return null;
  return aSets > bSets ? regAId : regBId;
}

export function totalRoundsForMatches(matches: { round: number }[]): number {
  return matches.reduce((m, x) => Math.max(m, x.round), 0);
}

/**
 * Devuelve true si `now` cae dentro de la ventana asumida del partido
 * (scheduled_at + duración por defecto). Compartido entre BracketView y
 * BracketTabs para no duplicar la heurística.
 */
export function isMatchLive(
  m: { scheduled_at: string | null; status: string | null },
  assumedDurationMin = 90,
): boolean {
  if (!m.scheduled_at || m.status !== "programado") return false;
  const start = Date.parse(m.scheduled_at);
  if (!Number.isFinite(start)) return false;
  const end = start + assumedDurationMin * 60 * 1000;
  const now = Date.now();
  return now >= start && now <= end;
}

export const CATEGORY_COLOR_VARS = [
  "hsl(var(--primary))",
  "hsl(var(--gold))",
  "hsl(var(--success))",
  "hsl(var(--accent))",
];

export const categoryColor = (index: number) =>
  CATEGORY_COLOR_VARS[index % CATEGORY_COLOR_VARS.length];
