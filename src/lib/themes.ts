export type ThemeId =
  | "arena"
  | "cement"
  | "clay"
  | "grass"
  | "seasonal"
  | "terre-battue"
  | "us-open"
  | "wimbledon";
export type ThemeMode = "light" | "dark" | "system";

// Superficies seleccionables (Épica K) — temas con bloque CSS propio. 'seasonal'
// NO está aquí: es un MODO que resuelve a una de estas superficies por mes.
export const SURFACE_THEME_IDS = ["arena", "cement", "clay", "grass"] as const;
export type SurfaceThemeId = (typeof SURFACE_THEME_IDS)[number];
export const isSeasonalTheme = (t: unknown): t is "seasonal" => t === "seasonal";
export const isSurfaceTheme = (t: unknown): t is SurfaceThemeId =>
  typeof t === "string" && (SURFACE_THEME_IDS as readonly string[]).includes(t);

/**
 * CONTRATO DE ROLES (homologado — Épica G). Fuente de verdad de los acentos.
 * Cada rol = UN hue distinto, CONSTANTE en todos los temas. Un tema solo cambia
 * SUPERFICIES (base dark / elevaciones / bordes / ink), nunca estos hues de rol.
 * Reusado por Cemento/Arcilla/Pasto en la Épica K.
 *
 * Las 3 capas del producto quedan SIEMPRE separadas por color de rol:
 *   habilidad → skill(volt) · enganche → action(naranja)/info(azul) ·
 *   premio → fichas(oro). confirm(verde) = feedback positivo.
 *
 * Firewall visual: el color de rol es 100% presentación; NO implica cruce de
 * capas de datos y NO toca ledgers ni RPCs. Los tokens viven como CSS vars
 * (`--skill`, `--action`, …) que el ThemeProvider intercambia por tema.
 */
export type RoleKey = "skill" | "action" | "fichas" | "info" | "confirm";
export interface RoleToken {
  /** Hex definitivo homologado. */
  hex: string;
  /** Mismo color en convención shadcn (H S% L%) — así vive en index.css. */
  hsl: string;
  /** Rol semántico (no es un color "suelto"). */
  role: string;
}
export const ROLE_PALETTE: Record<RoleKey, RoleToken> = {
  skill: { hex: "#C6FF1A", hsl: "75 100% 55%", role: "habilidad / XP" },
  action: { hex: "#EC6E2E", hsl: "20 83% 55%", role: "marca + CTA · Desafío · EN VIVO · racha" },
  fichas: { hex: "#FFC53D", hsl: "42 100% 62%", role: "Fichas / premio" },
  info: { hex: "#6E86FF", hsl: "230 100% 72%", role: "info / Descubrir / portabilidad" },
  confirm: { hex: "#2BD17E", hsl: "150 66% 49%", role: "confirmación / positivo" },
};

/** Rampa del naranja de acción (mismo hue): glow=realces, deep=sombras/depth. */
export const ACTION_RAMP = { base: "#EC6E2E", glow: "#FF8A4D", deep: "#B8521C" } as const;

/**
 * Contrato de SUPERFICIES que cada tema implementa (los roles de arriba son
 * constantes; estas son las variables que un tema NUEVO sí redefine). Sirve de
 * guía para la Épica K: agregar un tema = dar valores a estas superficies, sin
 * tocar los roles. Lista los nombres de CSS var, no valores.
 */
export const SURFACE_CONTRACT = [
  "background", "foreground",
  "card", "card-foreground",
  "popover", "popover-foreground",
  "secondary", "secondary-foreground",
  "muted", "muted-foreground",
  "accent", "accent-foreground",
  "border", "input", "ring",
] as const;

export interface ThemeMeta {
  id: ThemeId;
  label: string;
  sublabel: string;
  swatches: string[]; // 4 colores para preview
  fontDisplay: string;
  fontSans: string;
}

export const THEMES: Record<ThemeId, ThemeMeta> = {
  // 'arena' es el tema DEFAULT (dark). Paleta HOMOLOGADA (Épica G): superficies
  // navy + roles volt/naranja/oro/azul/verde. El reskin de pantallas llega en H/J.
  arena: {
    id: "arena",
    label: "Arena",
    sublabel: "Dark · navy profundo · naranja de acción — el tema por defecto",
    // preview: superficie · acción(naranja) · skill(volt) · fichas(oro)
    swatches: ["#0D111C", "#EC6E2E", "#C6FF1A", "#FFC53D"],
    fontDisplay: '"Archivo", system-ui, sans-serif',
    fontSans: '"DM Sans", system-ui, sans-serif',
  },
  // Temas estacionales de SUPERFICIE (Épica K). Roles homologados constantes
  // (skill/action/fichas/info/confirm desde :root); solo cambia la superficie.
  cement: {
    id: "cement",
    label: "Cemento",
    sublabel: "Hard · azul-cemento · plexicushion nocturno",
    swatches: ["#0F1B2E", "#EC6E2E", "#C6FF1A", "#6E86FF"],
    fontDisplay: '"Archivo", system-ui, sans-serif',
    fontSans: '"DM Sans", system-ui, sans-serif',
  },
  clay: {
    id: "clay",
    label: "Arcilla",
    sublabel: "Polvo de ladrillo · terracota · Roland-Garros",
    swatches: ["#1F120B", "#EC6E2E", "#C6FF1A", "#FFC53D"],
    fontDisplay: '"Archivo", system-ui, sans-serif',
    fontSans: '"DM Sans", system-ui, sans-serif',
  },
  grass: {
    id: "grass",
    label: "Pasto",
    sublabel: "Césped · verde inglés · Wimbledon clásico",
    swatches: ["#0C1F13", "#EC6E2E", "#C6FF1A", "#2BD17E"],
    fontDisplay: '"Archivo", system-ui, sans-serif',
    fontSans: '"DM Sans", system-ui, sans-serif',
  },
  seasonal: {
    id: "seasonal",
    label: "Estacional",
    sublabel: "Auto · rota la superficie según la temporada de tenis",
    swatches: ["#0D111C", "#0F1B2E", "#1F120B", "#0C1F13"],
    fontDisplay: '"Archivo", system-ui, sans-serif',
    fontSans: '"DM Sans", system-ui, sans-serif',
  },
  "terre-battue": {
    id: "terre-battue",
    label: "Arcilla AcePlay",
    sublabel: "Clay · cream · ink · oliva — la base AcePlay",
    swatches: ["#b6502b", "#5d6a39", "#c0a042", "#f8f6f2"],
    fontDisplay: '"Cormorant Garamond", Georgia, serif',
    fontSans: '"DM Sans", system-ui, sans-serif',
  },
  "us-open": {
    id: "us-open",
    label: "Noche de Nueva York",
    sublabel: "Azul profundo · neón · cancha dura",
    swatches: ["#0058A8", "#D7E80B", "#7A2E8E", "#0E1A2B"],
    fontDisplay: '"Archivo", system-ui, sans-serif',
    fontSans: "Inter, system-ui, sans-serif",
  },
  wimbledon: {
    id: "wimbledon",
    label: "Césped Real",
    sublabel: "Verde inglés · púrpura · marfil",
    swatches: ["#15553B", "#4B2E83", "#C9A24B", "#F4EFE6"],
    fontDisplay: '"Cormorant Garamond", Georgia, serif',
    fontSans: "Inter, system-ui, sans-serif",
  },
};

export const THEME_IDS: ThemeId[] = [
  "arena", "cement", "clay", "grass", "seasonal",
  "terre-battue", "us-open", "wimbledon",
];

// Tarjetas que muestra el selector de Apariencia (Perfil → Ajustes).
export const PICKER_THEME_IDS: ThemeId[] = ["arena", "cement", "clay", "grass", "seasonal"];
export const THEME_MODES: ThemeMode[] = ["light", "dark", "system"];

// Arena (dark) es el DEFAULT de la app desde el arranque.
export const DEFAULT_THEME: ThemeId = "arena";
export const DEFAULT_MODE: ThemeMode = "dark";

export const THEME_STORAGE_KEY = "aceplay.theme";
export const THEME_MODE_STORAGE_KEY = "aceplay.theme_mode";
// Flag local: "1" si el usuario cambió tema/modo desde el último sync con profiles.
// Si está activo, al hidratar el perfil hacemos PUSH (local → remoto) en vez de pull.
export const THEME_DIRTY_KEY = "aceplay.theme_dirty";

// Migración silenciosa de valores legacy en localStorage.
const LEGACY_THEME_MAP: Record<string, ThemeId> = {
  "etat-francais": "us-open",
};

export const normalizeThemeId = (v: unknown): ThemeId | null => {
  if (typeof v !== "string") return null;
  if ((THEME_IDS as string[]).includes(v)) return v as ThemeId;
  if (v in LEGACY_THEME_MAP) return LEGACY_THEME_MAP[v];
  return null;
};

export const isThemeId = (v: unknown): v is ThemeId =>
  typeof v === "string" && (THEME_IDS as string[]).includes(v);

export const isThemeMode = (v: unknown): v is ThemeMode =>
  typeof v === "string" && (THEME_MODES as string[]).includes(v);
