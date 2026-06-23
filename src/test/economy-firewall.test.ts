import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * FIREWALL DE 3 CRUCES (invariante de arquitectura, auditado estáticamente sobre
 * las migraciones SQL):
 *   (a) Nada de la capa de XP escribe jamás en el ledger de Rating
 *       (player_ratings / rating_history) ni llama al motor Glicko
 *       (apply_match_to_ratings).
 *   (b/c) xp_ledger y points_ledger (capa de HABILIDAD) son independientes:
 *       ninguna RPC de XP toca points_ledger.
 *
 * El test lee el SQL real de la capa de economía y verifica que NINGUNA función
 * referencie esos símbolos prohibidos (ignorando comentarios, que sí los nombran
 * para documentar el firewall). Si alguien acopla XP al motor en el futuro, este
 * test se pone rojo.
 */

const MIG_DIR = join(process.cwd(), "supabase", "migrations");

const ECONOMY_FILE_RE = /economy_xp_schema|economy_xp_rpcs|economy_read_rpcs|economy_demo_seed/;

// Símbolos del MOTOR competitivo que la capa de XP nunca debe tocar.
const FORBIDDEN = [
  "player_ratings",
  "rating_history",
  "points_ledger",
  "apply_match_to_ratings",
];

// Quita comentarios SQL (línea `--` y bloque `/* */`) — ahí sí se nombran los
// símbolos a propósito para documentar el firewall.
function stripSqlComments(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => line.replace(/--.*$/, ""))
    .join("\n");
}

const economyFiles = readdirSync(MIG_DIR).filter((f) => ECONOMY_FILE_RE.test(f));

describe("Firewall: la capa de enganche (XP) está separada del motor de Rating", () => {
  it("encuentra las migraciones de la capa de economía para auditar", () => {
    expect(economyFiles.length).toBeGreaterThan(0);
  });

  for (const file of economyFiles) {
    const code = stripSqlComments(readFileSync(join(MIG_DIR, file), "utf8"));
    for (const token of FORBIDDEN) {
      it(`${file}: ninguna sentencia referencia "${token}" (solo en comentarios)`, () => {
        expect(code).not.toContain(token);
      });
    }
  }

  it("award_xp existe y escribe SOLO en xp_ledger (no en el ledger de rating)", () => {
    const rpcs = economyFiles.find((f) => /economy_xp_rpcs/.test(f));
    expect(rpcs).toBeTruthy();
    const code = stripSqlComments(readFileSync(join(MIG_DIR, rpcs!), "utf8"));
    expect(code).toMatch(/function\s+public\.award_xp/);
    expect(code).toMatch(/insert\s+into\s+public\.xp_ledger/i);
    // El Glicko solo se alimenta de partidos confirmados (su trigger), NO de XP.
    for (const token of FORBIDDEN) expect(code).not.toContain(token);
  });
});
