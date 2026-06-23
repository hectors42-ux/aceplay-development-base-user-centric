export type ThemeId = "arena" | "terre-battue" | "us-open" | "wimbledon";
export type ThemeMode = "light" | "dark" | "system";

export interface ThemeMeta {
  id: ThemeId;
  label: string;
  sublabel: string;
  swatches: string[]; // 4 colores para preview
  fontDisplay: string;
  fontSans: string;
}

export const THEMES: Record<ThemeId, ThemeMeta> = {
  // 'arena' es el tema DEFAULT (dark). Tokens placeholder por ahora; el reskin
  // fino llega en la Fase 2 (G-J).
  arena: {
    id: "arena",
    label: "Arena",
    sublabel: "Dark · arena · cancha — el tema por defecto",
    swatches: ["#0f1115", "#d99a3e", "#2f9e9e", "#e9e3d6"],
    fontDisplay: '"Archivo", system-ui, sans-serif',
    fontSans: "Inter, system-ui, sans-serif",
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

export const THEME_IDS: ThemeId[] = ["arena", "terre-battue", "us-open", "wimbledon"];
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
