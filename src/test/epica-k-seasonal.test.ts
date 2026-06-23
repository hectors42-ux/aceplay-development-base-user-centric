import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveSeasonalTheme, DEFAULT_SEASONAL_CALENDAR, type SeasonalSegment } from "@/lib/seasonal-theme";
import { THEMES, PICKER_THEME_IDS, isSeasonalTheme, isSurfaceTheme } from "@/lib/themes";

const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), "utf8");

describe("Épica K — resolveSeasonalTheme (calendario de la gira de tenis)", () => {
  // mes 0-based en Date: enero = 0.
  const cases: Array<[Date, string]> = [
    [new Date(2026, 0, 15), "cement"], // 15-ene → cancha dura
    [new Date(2026, 2, 31), "cement"], // 31-mar → cemento
    [new Date(2026, 3, 1), "clay"],    // 1-abr → arcilla
    [new Date(2026, 5, 30), "clay"],   // 30-jun → arcilla (antes del corte a pasto)
    [new Date(2026, 6, 1), "grass"],   // 1-jul → pasto
    [new Date(2026, 7, 14), "grass"],  // 14-ago → pasto (antes del corte)
    [new Date(2026, 7, 15), "cement"], // 15-ago → vuelve a cemento (US Open)
    [new Date(2026, 8, 1), "cement"],  // 1-sep → cemento
    [new Date(2026, 10, 30), "cement"],// 30-nov → cemento
    [new Date(2026, 11, 1), "arena"],  // 1-dic → arena (off-season)
    [new Date(2026, 11, 15), "arena"], // 15-dic → arena
  ];
  for (const [date, expected] of cases) {
    it(`${date.toISOString().slice(0, 10)} → ${expected}`, () => {
      expect(resolveSeasonalTheme(date, DEFAULT_SEASONAL_CALENDAR)).toBe(expected);
    });
  }

  it("usa el CALENDARIO pasado (config), no constantes hardcodeadas", () => {
    const allArena: SeasonalSegment[] = [{ month: 1, day: 1, theme: "arena" }];
    expect(resolveSeasonalTheme(new Date(2026, 6, 1), allArena)).toBe("arena"); // jul, pero el calendar dice arena
    const allGrass: SeasonalSegment[] = [{ month: 1, day: 1, theme: "grass" }];
    expect(resolveSeasonalTheme(new Date(2026, 0, 1), allGrass)).toBe("grass");
  });

  it("calendario vacío → arena (fallback seguro)", () => {
    expect(resolveSeasonalTheme(new Date(2026, 5, 1), [])).toBe("arena");
  });
});

describe("Épica K — registro de temas y selector", () => {
  it("el selector ofrece arena/cemento/arcilla/pasto/estacional", () => {
    expect(PICKER_THEME_IDS).toEqual(["arena", "cement", "clay", "grass", "seasonal"]);
    for (const id of PICKER_THEME_IDS) expect(THEMES[id]?.label).toBeTruthy();
  });
  it("seasonal es un MODO (no superficie); las superficies son arena/cement/clay/grass", () => {
    expect(isSeasonalTheme("seasonal")).toBe(true);
    expect(isSurfaceTheme("seasonal")).toBe(false);
    for (const s of ["arena", "cement", "clay", "grass"]) expect(isSurfaceTheme(s)).toBe(true);
  });
  it("el CSS define los tres temas de superficie nuevos", () => {
    const css = read("src", "index.css");
    for (const t of ["cement", "clay", "grass"]) {
      expect(css).toMatch(new RegExp(`:root\\.theme-${t}`));
    }
  });
});

describe("Firewall: cambiar de tema (incl. seasonal) no escribe en ledgers", () => {
  const FORBIDDEN = ["player_ratings", "rating_history", "xp_ledger", "fichas_ledger", "points_ledger", "award_xp", "grant_fichas"];
  const files: Record<string, string> = {
    "seasonal-theme.ts": read("src", "lib", "seasonal-theme.ts"),
    "themes.ts": read("src", "lib", "themes.ts"),
    "ThemeContext.tsx": read("src", "contexts", "ThemeContext.tsx"),
  };
  for (const [name, src] of Object.entries(files)) {
    for (const token of FORBIDDEN) {
      it(`${name} no referencia "${token}"`, () => expect(src).not.toContain(token));
    }
  }
});
