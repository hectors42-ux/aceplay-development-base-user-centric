// Modo "Estacional (auto)" — rota la SUPERFICIE del tema según el mes, siguiendo
// el calendario real de la gira de tenis (Épica K). Util PURO y testeable:
// recibe la fecha y (opcional) el calendario; el calendario por defecto se puede
// sobreescribir desde economy_config (seasonal_theme_calendar) — NO es hardcode.

export type SurfaceTheme = "arena" | "cement" | "clay" | "grass";

/** Segmento del calendario: a partir de (month, day) aplica `theme`. month 1-12. */
export interface SeasonalSegment {
  month: number;
  day: number;
  theme: SurfaceTheme;
}

// Calendario por defecto (hemisferio norte). Editable por admin vía economy_config.
//   Ene–Mar        → Cemento  (gira dura)
//   Abr–7 Jun      → Arcilla  (polvo de ladrillo → Roland-Garros)
//   8 Jun–Jul      → Pasto    (Wimbledon / gira de césped)
//   Ago–Nov        → Cemento  (US Open + cierre dura/indoor)
//   Dic            → Arena    (off-season: vuelve al look insignia)
export const DEFAULT_SEASONAL_CALENDAR: SeasonalSegment[] = [
  { month: 1, day: 1, theme: "cement" },
  { month: 4, day: 1, theme: "clay" },
  { month: 6, day: 8, theme: "grass" },
  { month: 8, day: 1, theme: "cement" },
  { month: 12, day: 1, theme: "arena" },
];

/** Frase de temporada para el selector ("Ahora: Arcilla · …"). */
export const SEASONAL_BLURB: Record<SurfaceTheme, string> = {
  arena: "off-season · look insignia",
  cement: "temporada de cancha dura",
  clay: "temporada de polvo de ladrillo",
  grass: "temporada de césped",
};

const keyOf = (month: number, day: number) => month * 100 + day;

/**
 * Resuelve la superficie efectiva para una fecha. PURO: no usa `new Date()` ni
 * config global; todo entra por parámetros. `hemisphere` se acepta para ajuste
 * futuro (no se construye geolocalización ahora).
 */
export function resolveSeasonalTheme(
  date: Date,
  calendar: SeasonalSegment[] = DEFAULT_SEASONAL_CALENDAR,
  _hemisphere: "north" | "south" = "north",
): SurfaceTheme {
  if (!calendar.length) return "arena";
  const sorted = [...calendar].sort((a, b) => keyOf(a.month, a.day) - keyOf(b.month, b.day));
  const k = keyOf(date.getMonth() + 1, date.getDate());
  let current = sorted[sorted.length - 1].theme; // wrap-around (antes del primer corte → último segmento)
  for (const seg of sorted) {
    if (keyOf(seg.month, seg.day) <= k) current = seg.theme;
    else break;
  }
  return current;
}
