import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Firewall Épica D:
 *  - organizer_metrics / organizer_revenue_log y sus RPCs NO tocan los ledgers
 *    de jugadores (rating / xp / fichas / points).
 *  - No existe función que convierta métricas de organizador en VENTAJA
 *    competitiva del jugador, ni índice de mérito / "mejor organizador"
 *    (alcance estricto: solo captura de dato crudo).
 */
const ROOT = process.cwd();
const MIG_DIR = join(ROOT, "supabase", "migrations");

const FORBIDDEN_LEDGERS = ["player_ratings", "rating_history", "xp_ledger", "fichas_ledger", "points_ledger", "award_xp", "grant_fichas"];
// Conceptos que esta épica NO debe introducir (se definen después).
const FORBIDDEN_MERIT = [/merit/i, /best_organizer/i, /organizer_score/i, /organizer_rank/i, /organizer_index/i, /elite/i];

const stripSql = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").map((l) => l.replace(/--.*$/, "")).join("\n");

const epicaDMigrations = readdirSync(MIG_DIR).filter((f) => /organizer_metrics/.test(f));

describe("Firewall: la medición del organizador no toca ledgers ni deriva mérito", () => {
  it("hay migraciones de Épica D para auditar", () => expect(epicaDMigrations.length).toBeGreaterThan(0));

  for (const f of epicaDMigrations) {
    const code = stripSql(readFileSync(join(MIG_DIR, f), "utf8"));
    for (const token of FORBIDDEN_LEDGERS) {
      it(`${f}: no escribe en "${token}"`, () => expect(code).not.toContain(token));
    }
    for (const re of FORBIDDEN_MERIT) {
      it(`${f}: no introduce mérito/ranking (${re})`, () => expect(code).not.toMatch(re));
    }
  }

  it("organizer_metrics guarda solo dato CRUDO (3 ratios), sin score derivado", () => {
    // Sobre el CÓDIGO (sin comentarios): los comentarios pueden decir "sin score".
    const schema = stripSql(readFileSync(join(MIG_DIR, epicaDMigrations.find((f) => /schema/.test(f))!), "utf8"));
    expect(schema).toMatch(/completion_rate/);
    expect(schema).toMatch(/retention/);
    expect(schema).toMatch(/data_quality/);
    expect(schema).not.toMatch(/score|ranking|merit/i);
  });

  it("el panel y los hooks de organizador no referencian ledgers de jugadores", () => {
    const page = readFileSync(join(ROOT, "src", "pages", "admin", "OrganizerPanel.tsx"), "utf8");
    const hook = readFileSync(join(ROOT, "src", "hooks", "useOrganizer.ts"), "utf8");
    for (const token of FORBIDDEN_LEDGERS) {
      expect(page).not.toContain(token);
      expect(hook).not.toContain(token);
    }
  });
});
