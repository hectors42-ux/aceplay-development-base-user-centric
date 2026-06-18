
export type CompetitionMotor = string /* TODO: cablear fase 2 */;
export type TournamentSport = string /* TODO: cablear fase 2 */;
export type TournamentModality = string /* TODO: cablear fase 2 */;

export type Scoring =
  | "sets_2_de_3"
  | "sets_1_de_3"
  | "pro_set_8"
  | "tiebreak_10";

export type SchedulingMode =
  | "fechas_fijas"
  | "acuerdo_jugadores"
  | "rondas_semanales";

export type CloseMode = "automatico_al_completar" | "manual";

/** Las 5 perillas crudas que cualquier preset materializa. */
export interface PresetKnobs {
  motor: CompetitionMotor;
  scoring: Scoring;
  bestOf: number;
  schedulingMode: SchedulingMode;
  closeMode: CloseMode;
}

export type PresetKey =
  | "eliminacion_simple"
  | "consolacion"
  | "doble_eliminacion"
  | "round_robin_liga"
  | "escalerilla"
  | "grupos_playoff"
  | "americano_parejas"
  | "americano_rotacion"
  | "escalera"
  | "personalizado";

export interface PresetDef {
  key: PresetKey;
  label: string;
  /** Una línea explicando el formato — visible en la grilla. */
  helper: string;
  defaults: PresetKnobs;
  /** false → "Próximamente", no seleccionable como activo. */
  available: boolean;
}

const BASE: PresetKnobs = {
  motor: "eliminacion_simple",
  scoring: "sets_2_de_3",
  bestOf: 3,
  schedulingMode: "fechas_fijas",
  closeMode: "automatico_al_completar",
};

export const TOURNAMENT_PRESETS: PresetDef[] = [
  {
    key: "eliminacion_simple",
    label: "Eliminación simple",
    helper: "Llave clásica: el que pierde queda fuera.",
    defaults: { ...BASE },
    available: true,
  },
  {
    key: "consolacion",
    label: "Cuadro de consolación",
    helper: "Eliminación simple con segundo cuadro para los que pierden en primera.",
    defaults: { ...BASE, motor: "consolacion" },
    available: true,
  },
  {
    key: "doble_eliminacion",
    label: "Doble eliminación",
    helper: "Hace falta perder dos veces para quedar eliminado.",
    defaults: { ...BASE, motor: "doble_eliminacion" },
    available: true,
  },
  {
    key: "round_robin_liga",
    label: "Liga (todos contra todos)",
    helper: "Cada jugador juega contra todos los demás. Gana el de mejor tabla.",
    defaults: { ...BASE, motor: "round_robin", schedulingMode: "rondas_semanales" },
    available: true,
  },
  {
    key: "escalerilla",
    label: "Escalerilla",
    helper: "Los jugadores suben o bajan posiciones según resultados.",
    defaults: { ...BASE, scoring: "pro_set_8", schedulingMode: "acuerdo_jugadores" },
    available: false,
  },
  {
    key: "grupos_playoff",
    label: "Grupos + playoff",
    helper: "Fase de grupos y luego llave de eliminación con los clasificados.",
    defaults: { ...BASE, motor: "grupos_playoff", schedulingMode: "fechas_fijas" },
    available: true,
  },
  {
    key: "americano_parejas",
    label: "Americano (parejas fijas)",
    helper: "Parejas fijas durante todo el torneo.",
    defaults: { ...BASE, scoring: "tiebreak_10", schedulingMode: "fechas_fijas" },
    available: false,
  },
  {
    key: "americano_rotacion",
    label: "Americano (rotación)",
    helper: "Rotación de compañero cada ronda.",
    defaults: { ...BASE, scoring: "tiebreak_10", schedulingMode: "fechas_fijas" },
    available: true,
  },
  {
    key: "escalera",
    label: "Escalera",
    helper: "Sistema de desafíos: cada victoria sube posiciones.",
    defaults: { ...BASE, scoring: "pro_set_8", schedulingMode: "acuerdo_jugadores" },
    available: false,
  },
  {
    key: "personalizado",
    label: "Personalizado",
    helper: "Parte de los valores actuales y ajustá las perillas manualmente.",
    defaults: { ...BASE },
    available: true,
  },
];

export const PRESETS_BY_KEY: Record<PresetKey, PresetDef> = TOURNAMENT_PRESETS.reduce(
  (acc, p) => {
    acc[p.key] = p;
    return acc;
  },
  {} as Record<PresetKey, PresetDef>,
);

export function getPresetLabel(key: string | null | undefined): string {
  if (!key) return "Eliminación simple (legacy)";
  return PRESETS_BY_KEY[key as PresetKey]?.label ?? key;
}

/** Reglas operativas heredables que no son perillas técnicas. */
export interface EventDefaults {
  sport?: TournamentSport;
  modality?: TournamentModality;
  presetKey?: PresetKey;
  knobs?: Partial<PresetKnobs>;
  cuotaClp?: number;
  premios?: string;
}

export interface CategoryOverrides extends EventDefaults {}

export type InheritableKey = keyof EventDefaults;

const INHERITABLE_KEYS: InheritableKey[] = [
  "sport",
  "modality",
  "presetKey",
  "knobs",
  "cuotaClp",
  "premios",
];

export interface ResolvedConfig {
  value: EventDefaults;
  inheritedKeys: Set<InheritableKey>;
}

/**
 * Merge categoría sobre evento. Las claves presentes (no undefined) en la
 * categoría ganan; el resto se considera heredado del evento.
 */
export function resolveCategoryConfig(
  eventDefaults: EventDefaults | null | undefined,
  categoryConfig: CategoryOverrides | null | undefined,
): ResolvedConfig {
  const evt = eventDefaults ?? {};
  const cat = categoryConfig ?? {};
  const value: EventDefaults = {};
  const inheritedKeys = new Set<InheritableKey>();
  for (const k of INHERITABLE_KEYS) {
    const catVal = cat[k];
    if (catVal !== undefined && catVal !== null && !(typeof catVal === "string" && catVal === "")) {
      // @ts-expect-error índice paramétrico válido
      value[k] = catVal;
    } else if (evt[k] !== undefined && evt[k] !== null) {
      // @ts-expect-error índice paramétrico válido
      value[k] = evt[k];
      inheritedKeys.add(k);
    }
  }
  return { value, inheritedKeys };
}

/** Lee jsonb crudo de la DB y lo tipa de forma defensiva. */
export function parseEventDefaults(raw: unknown): EventDefaults {
  if (!raw || typeof raw !== "object") return {};
  return raw as EventDefaults;
}