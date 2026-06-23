import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_THEME, DEFAULT_MODE, THEME_IDS, THEMES, isThemeId } from "@/lib/themes";

describe("Épica F — Arena es el tema DEFAULT, manteniendo los claros seleccionables", () => {
  it("el default es Arena (dark)", () => {
    expect(DEFAULT_THEME).toBe("arena");
    expect(DEFAULT_MODE).toBe("dark");
  });
  it("Arena está registrado + los temas claros siguen disponibles", () => {
    expect(isThemeId("arena")).toBe(true);
    expect(THEMES.arena?.label).toBeTruthy();
    for (const t of ["terre-battue", "us-open", "wimbledon"]) {
      expect(THEME_IDS).toContain(t);
    }
    expect(THEME_IDS[0]).toBe("arena");
  });
  it("el CSS define los tokens placeholder de .theme-arena", () => {
    const css = readFileSync(join(process.cwd(), "src", "index.css"), "utf8");
    expect(css).toMatch(/\.theme-arena/);
    expect(css).toMatch(/:root\.theme-arena[\s\S]*--background:/);
  });
});

describe("Firewall: cambiar tema o navegar no escribe en ningún ledger", () => {
  const FORBIDDEN = ["player_ratings", "rating_history", "xp_ledger", "fichas_ledger", "points_ledger", "award_xp", "grant_fichas", "redeem_ficha"];
  const stripJs = (s: string) =>
    s.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").map((l) => l.replace(/\/\/.*$/, "")).join("\n");
  const FILES = [
    ["src", "contexts", "ThemeContext.tsx"],
    ["src", "components", "BottomNav.tsx"],
    ["src", "components", "AppShell.tsx"],
    ["src", "pages", "Espacios.tsx"],
  ];

  for (const parts of FILES) {
    const src = stripJs(readFileSync(join(process.cwd(), ...parts), "utf8"));
    for (const token of FORBIDDEN) {
      it(`${parts.at(-1)} no referencia "${token}"`, () => expect(src).not.toContain(token));
    }
  }

  it("ThemeContext solo persiste en profiles (theme/theme_mode), no en ledgers", () => {
    const src = stripJs(readFileSync(join(process.cwd(), "src", "contexts", "ThemeContext.tsx"), "utf8"));
    expect(src).toMatch(/\.from\("profiles"\)/);
    expect(src).toMatch(/theme_mode/);
  });
});
