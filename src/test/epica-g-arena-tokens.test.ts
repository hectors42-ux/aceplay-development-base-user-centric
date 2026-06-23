import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROLE_PALETTE, ACTION_RAMP, SURFACE_CONTRACT, THEMES } from "@/lib/themes";

const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), "utf8");
const css = read("src", "index.css");
const tw = read("tailwind.config.ts");
const themesSrc = read("src", "lib", "themes.ts");

describe("Épica G — paleta homologada del tema Arena", () => {
  it("cada rol tiene su hex definitivo homologado", () => {
    expect(ROLE_PALETTE.skill.hex).toBe("#C6FF1A"); // volt
    expect(ROLE_PALETTE.action.hex).toBe("#EC6E2E"); // naranja (marca + CTA)
    expect(ROLE_PALETTE.fichas.hex).toBe("#FFC53D"); // oro
    expect(ROLE_PALETTE.info.hex).toBe("#6E86FF"); // azul
    expect(ROLE_PALETTE.confirm.hex).toBe("#2BD17E"); // verde
    expect(ACTION_RAMP).toEqual({ base: "#EC6E2E", glow: "#FF8A4D", deep: "#B8521C" });
  });

  it("CTA/Desafío = UN SOLO naranja #EC6E2E (marca = acción)", () => {
    expect(ROLE_PALETTE.action.role).toMatch(/CTA|Desafío/i);
    // El tema Arena mapea --primary (el CTA shadcn) al naranja de acción.
    expect(css).toMatch(/:root\.theme-arena[\s\S]*?--primary:\s*20 83% 55%/);
    // …y el rol marca/acción comparte ese hue (un solo naranja homologado).
    expect(css).toMatch(/--action:\s*20 83% 55%/);
    expect(css).toMatch(/--brand:\s*20 83% 55%/);
  });

  it("los tokens de rol viven en CSS con el HSL del contrato", () => {
    for (const [key, token] of Object.entries(ROLE_PALETTE)) {
      expect(css).toContain(`--${key}: ${token.hsl}`);
    }
  });

  it("cada rol es un hue distinto (nunca dos casi iguales)", () => {
    const hues = Object.values(ROLE_PALETTE).map((t) => parseInt(t.hsl, 10));
    expect(new Set(hues).size).toBe(hues.length);
  });

  it("tailwind registra los colores de rol y las fuentes del contrato", () => {
    for (const role of ["skill", "action", "brand", "fichas", "info", "confirm"]) {
      expect(tw).toContain(`${role}: {`);
    }
    expect(tw).toContain("hsl(var(--action))");
    for (const font of ["archivo", "cormorant", "dm-sans"]) {
      expect(tw).toContain(font);
    }
  });

  it("Arena usa Archivo (display) + DM Sans (texto) y aplica vía CSS vars", () => {
    expect(THEMES.arena.fontDisplay).toMatch(/Archivo/);
    expect(THEMES.arena.fontSans).toMatch(/DM Sans/);
    expect(css).toMatch(/:root\.theme-arena[\s\S]*?--font-display:\s*'Archivo'/);
  });

  it("el contrato de superficies está documentado para la Épica K", () => {
    expect(SURFACE_CONTRACT).toContain("background");
    expect(SURFACE_CONTRACT).toContain("foreground");
    // los roles NO son superficies (se mantienen constantes entre temas)
    expect(SURFACE_CONTRACT).not.toContain("action");
    expect(SURFACE_CONTRACT).not.toContain("skill");
  });
});

describe("Firewall: definir/cambiar tokens es 100% visual — no toca ledgers", () => {
  const FORBIDDEN = [
    "player_ratings", "rating_history", "xp_ledger", "fichas_ledger",
    "points_ledger", "award_xp", "grant_fichas", "redeem_ficha",
  ];
  const files: Record<string, string> = {
    "index.css": css,
    "tailwind.config.ts": tw,
    "lib/themes.ts": themesSrc,
  };
  for (const [name, src] of Object.entries(files)) {
    for (const token of FORBIDDEN) {
      it(`${name} no referencia "${token}"`, () => expect(src).not.toContain(token));
    }
  }
});
