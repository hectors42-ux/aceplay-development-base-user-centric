/**
 * Presets de co-marca por torneo. Cada preset es punto de partida —
 * el admin puede sobrescribir cualquier campo en `tournament_cobrand`.
 */

export interface CobrandPreset {
  brand_key: string;
  display_name: string;
  eyebrow_text: string;
  lockup_text: string;
  flag_country: string;
  primary_hex: string;
  accent_hex: string;
  gradient_css: string;
  logo_url?: string | null;
  rights_text?: string | null;
}

export const COBRAND_REGISTRY: Record<string, CobrandPreset> = {
  stade_francais: {
    brand_key: "stade_francais",
    display_name: "Stade Français",
    eyebrow_text: "Te invita Stade Français",
    lockup_text: "ACEPLAY × STADE FRANÇAIS",
    flag_country: "fr",
    primary_hex: "#14213D",
    accent_hex: "#C8102E",
    gradient_css:
      "linear-gradient(155deg, #14213D 10%, #1E3160 50%, #6a2050 110%)",
    rights_text:
      "Stade Français es sponsor oficial. Usa el material institucional al compartir resultados.",
  },
  pro_trainer: {
    brand_key: "pro_trainer",
    display_name: "Pro Trainer",
    eyebrow_text: "Powered by Pro Trainer",
    lockup_text: "ACEPLAY × PRO TRAINER",
    flag_country: "cl",
    primary_hex: "#0B3D2E",
    accent_hex: "#E0A800",
    gradient_css:
      "linear-gradient(155deg, #0B3D2E 10%, #155840 55%, #7a5a10 110%)",
  },
};

export const COBRAND_PRESET_KEYS = Object.keys(COBRAND_REGISTRY);

export function buildGradient(primaryHex: string, accentHex: string): string {
  return `linear-gradient(155deg, ${primaryHex} 10%, ${mixHex(primaryHex, accentHex, 0.5)} 55%, ${accentHex} 110%)`;
}

function mixHex(a: string, b: string, t: number): string {
  const ax = parseHex(a);
  const bx = parseHex(b);
  if (!ax || !bx) return a;
  const r = Math.round(ax[0] * (1 - t) + bx[0] * t);
  const g = Math.round(ax[1] * (1 - t) + bx[1] * t);
  const bl = Math.round(ax[2] * (1 - t) + bx[2] * t);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${bl.toString(16).padStart(2, "0")}`;
}

function parseHex(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Contraste WCAG entre dos colores hex. Retorna ratio (1..21). */
export function contrastRatio(fgHex: string, bgHex: string): number {
  const lf = relLuminance(fgHex);
  const lb = relLuminance(bgHex);
  if (lf == null || lb == null) return 1;
  const a = Math.max(lf, lb);
  const b = Math.min(lf, lb);
  return (a + 0.05) / (b + 0.05);
}

function relLuminance(hex: string): number | null {
  const parsed = parseHex(hex);
  if (!parsed) return null;
  const [r, g, b] = parsed.map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Sanitiza un texto plano: strip de tags HTML. */
export function sanitizePlain(input: string | null | undefined): string | null {
  if (input == null) return null;
  const stripped = String(input).replace(/<[^>]*>/g, "").trim();
  return stripped.length > 0 ? stripped : null;
}