import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Firewall de la capa de Premio (Fichas):
 *   (a) grant_fichas / redeem_ficha NUNCA tocan rating ni xp_ledger.
 *   (b) No hay ruta que convierta Fichas→XP ni XP→Fichas.
 *   (c) Hito→Fichas es explícito y unidireccional (monto fijo de config).
 *   + redeem_ficha es a prueba de doble-canje (advisory lock + dedup).
 *   + REGLA DE UI: la Tienda NUNCA muestra precios en pesos.
 */

const ROOT = process.cwd();
const MIG_DIR = join(ROOT, "supabase", "migrations");
const FORBIDDEN = ["player_ratings", "rating_history", "apply_match_to_ratings", "xp_ledger", "award_xp", "points_ledger"];

const stripSqlComments = (sql: string) =>
  sql.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").map((l) => l.replace(/--.*$/, "")).join("\n");

const fichasMigrations = readdirSync(MIG_DIR).filter((f) => /fichas_/.test(f));

describe("Firewall: las Fichas no tocan el motor (rating) ni el XP", () => {
  it("encuentra las migraciones de Fichas", () => {
    expect(fichasMigrations.length).toBeGreaterThan(0);
  });

  for (const file of fichasMigrations) {
    const code = stripSqlComments(readFileSync(join(MIG_DIR, file), "utf8"));
    for (const token of FORBIDDEN) {
      it(`${file}: ninguna sentencia referencia "${token}"`, () => {
        expect(code).not.toContain(token);
      });
    }
  }

  it("redeem_ficha es atómica y a prueba de doble-canje (lock + dedup)", () => {
    const rpcs = stripSqlComments(
      readFileSync(join(MIG_DIR, fichasMigrations.find((f) => /fichas_rpcs/.test(f))!), "utf8"),
    );
    expect(rpcs).toMatch(/function\s+public\.redeem_ficha/);
    expect(rpcs).toMatch(/pg_advisory_xact_lock/);          // serializa concurrentes
    expect(rpcs).toMatch(/deduplicated/);                    // dedup de doble-clic
    expect(rpcs).toMatch(/for update/i);                     // bloquea el reward_item
  });

  it("hito→Fichas otorga un monto FIJO de config (no derivado del XP)", () => {
    const rpcs = stripSqlComments(
      readFileSync(join(MIG_DIR, fichasMigrations.find((f) => /fichas_rpcs/.test(f))!), "utf8"),
    );
    // Los triggers de hito llaman grant_fichas con un valor de economy_config,
    // nunca leen xp_ledger ni convierten XP.
    expect(rpcs).toMatch(/grant_mission/);
    expect(rpcs).not.toContain("xp_ledger");
  });
});

describe("Regla de UI: la Tienda nunca muestra precios en pesos", () => {
  const PAGES = ["Tienda.tsx", "TiendaItem.tsx", "MisCanjes.tsx"];
  // Precios/equivalencias prohibidos ($8.000, ≈, CLP). Se escanea el código sin
  // comentarios (un comentario que diga "sin precios en pesos" no es un precio).
  const PRICE_PATTERNS: RegExp[] = [/\$\s*\d/, /≈/, /\bCLP\b/];
  const stripJsComments = (s: string) =>
    s.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").map((l) => l.replace(/\/\/.*$/, "")).join("\n");

  for (const page of PAGES) {
    it(`${page} no muestra ningún precio ni equivalencia en pesos`, () => {
      const src = stripJsComments(readFileSync(join(ROOT, "src", "pages", page), "utf8"));
      for (const re of PRICE_PATTERNS) expect(src).not.toMatch(re);
      // Sí debe expresar el costo en Fichas.
      expect(src).toMatch(/Fichas/);
    });
  }
});
