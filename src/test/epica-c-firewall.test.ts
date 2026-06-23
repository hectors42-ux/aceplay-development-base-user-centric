import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Firewall Épica C: el portal admin y los placements NO escriben en los ledgers
 * de usuarios (rating / xp / fichas). Editar economy_config cambia parámetros,
 * no inyecta saldos retroactivos.
 */
const ROOT = process.cwd();
const MIG_DIR = join(ROOT, "supabase", "migrations");
// Ledgers de usuarios que el admin/placements jamás deben escribir.
const FORBIDDEN = [
  "player_ratings", "rating_history", "xp_ledger", "fichas_ledger",
  "award_xp", "grant_fichas", "redeem_ficha",
];

const stripSql = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").map((l) => l.replace(/--.*$/, "")).join("\n");
const stripJs = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").map((l) => l.replace(/\/\/.*$/, "")).join("\n");

const epicaCMigrations = readdirSync(MIG_DIR).filter((f) => /brands_placements|sponsor_resolver/.test(f));
const ADMIN_PAGES = ["AdminBrands.tsx", "AdminRewards.tsx", "AdminPlacements.tsx", "AdminEconomy.tsx"];

describe("Firewall: brands/placements/admin no tocan ledgers de usuarios", () => {
  for (const f of epicaCMigrations) {
    const code = stripSql(readFileSync(join(MIG_DIR, f), "utf8"));
    for (const token of FORBIDDEN) {
      it(`migración ${f}: no referencia "${token}"`, () => expect(code).not.toContain(token));
    }
  }

  for (const p of ADMIN_PAGES) {
    const src = stripJs(readFileSync(join(ROOT, "src", "pages", "admin", p), "utf8"));
    for (const token of FORBIDDEN) {
      it(`admin ${p}: no referencia "${token}"`, () => expect(src).not.toContain(token));
    }
  }

  it("AdminEconomy solo actualiza economy_config (no inyecta saldos)", () => {
    const src = stripJs(readFileSync(join(ROOT, "src", "pages", "admin", "AdminEconomy.tsx"), "utf8"));
    expect(src).toMatch(/\.from\("economy_config"\)/);
    expect(src).not.toMatch(/\.from\("fichas_ledger"\)/);
    expect(src).not.toMatch(/\.from\("xp_ledger"\)/);
  });
});
