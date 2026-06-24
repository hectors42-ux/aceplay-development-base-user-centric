import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Firewall del cierre del loop (M5 · invitaciones / agenda / cargar / badge):
 *   (a) Las pantallas no premian (sin award_xp/grant_fichas).
 *   (b) record_challenge_result REUSA record_match (motor) y enlaza challenge.match_id;
 *       NO escribe en rating/xp/fichas/standings ni recalcula nada (eso lo hace el
 *       motor al confirmar). match_victory_card es SOLO LECTURA.
 *   (c) El badge de victoria es presentación: NO muestra precios en pesos.
 */

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const stripSql = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").map((l) => l.replace(/--.*$/, "")).join("\n");
const stripJs = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").map((l) => l.replace(/\/\/.*$/, "")).join("\n");

const PAGES = ["src/pages/Invitaciones.tsx", "src/pages/Agenda.tsx", "src/pages/CargarResultadoReto.tsx", "src/pages/Victoria.tsx"];

describe("Firewall M5: el cierre del loop no premia por fuera del motor", () => {
  for (const f of PAGES) {
    const code = read(f);
    for (const token of ["award_xp", "grant_fichas"]) {
      it(`${f}: no referencia "${token}"`, () => expect(code).not.toContain(token));
    }
  }
});

describe("M5 backend · materializar reto reusa el motor (no reimplementa)", () => {
  const MIG = join(ROOT, "supabase", "migrations");
  const file = readdirSync(MIG).find((f) => /cancha_m5/.test(f))!;
  const sql = stripSql(read(join("supabase", "migrations", file)));

  it("record_challenge_result llama a record_match (motor) y enlaza challenge.match_id", () => {
    const fn = sql.match(/function\s+public\.record_challenge_result[\s\S]*?\$\$;/i)?.[0] ?? "";
    expect(fn).toMatch(/public\.record_match\s*\(/i);
    expect(fn).toMatch(/update\s+public\.challenges\s+set\s+match_id/i);
  });

  it("M5 NO escribe directo en rating/xp/fichas/escalafón ni llama al engine", () => {
    for (const re of [
      /insert\s+into\s+public\.player_ratings/i,
      /update\s+public\.player_ratings/i,
      /insert\s+into\s+public\.rating_history/i,
      /insert\s+into\s+public\.xp_ledger/i,
      /insert\s+into\s+public\.fichas_ledger/i,
      /insert\s+into\s+public\.points_ledger/i,
      /update\s+public\.space_standing/i,
      /\baward_xp\s*\(/i,
      /\bgrant_fichas\s*\(/i,
      /\bapply_match_to_ratings\s*\(/i,
    ]) {
      expect(sql).not.toMatch(re);
    }
  });

  it("match_victory_card es SOLO LECTURA (lee ledgers, no escribe)", () => {
    const fn = sql.match(/function\s+public\.match_victory_card[\s\S]*?\$\$;/i)?.[0] ?? "";
    expect(fn).not.toMatch(/\binsert\s+into\b/i);
    expect(fn).not.toMatch(/\bupdate\s+public\./i);
    expect(fn).not.toMatch(/\bdelete\s+from\b/i);
  });
});

describe("Badge de victoria: presentación sin precios en pesos", () => {
  it("Victoria.tsx no muestra precios ni equivalencias en pesos", () => {
    const src = stripJs(read("src/pages/Victoria.tsx"));
    for (const re of [/\$\s*\d/, /≈/, /\bCLP\b/]) expect(src).not.toMatch(re);
  });
});
