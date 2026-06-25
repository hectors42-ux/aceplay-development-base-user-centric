import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Firewall de la VITRINA DE TORNEOS DEL JUGADOR (cableado de hooks al motor):
 * los hooks SOLO LEEN estado de torneo; ninguno escribe en rating/xp/fichas ni llama
 * al engine. El rating se mueve únicamente vía apply_tournament_result (motor existente)
 * tras resultado confirmado. La read RPC category_bundle es solo lectura.
 */

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const stripSql = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").map((l) => l.replace(/--.*$/, "")).join("\n");

const HOOKS = [
  "src/hooks/useTournamentsList.ts",
  "src/hooks/useTournamentDetailEnriched.ts",
  "src/hooks/useUserActiveTournament.ts",
  "src/hooks/useRoundRobinStandings.ts",
  "src/hooks/useRoundRobinGroupStandings.ts",
  "src/hooks/useAmericanoIndividualStandings.ts",
  "src/hooks/useAmericanoRounds.ts",
  "src/hooks/useTournamentGroups.ts",
  "src/hooks/useCategoryData.ts",
];
const FORBIDDEN = ["award_xp", "grant_fichas", "record_match", "apply_match_to_ratings", "apply_tournament_result"];

describe("Firewall vitrina de torneos: los hooks solo LEEN (no premian ni mueven rating)", () => {
  for (const h of HOOKS) {
    const code = read(h);
    for (const token of FORBIDDEN) {
      it(`${h}: no referencia "${token}"`, () => expect(code).not.toContain(token));
    }
    it(`${h}: no hace insert/update/delete directos`, () => {
      expect(code).not.toMatch(/\.(insert|update|delete|upsert)\s*\(/);
    });
  }
});

describe("category_bundle (read RPC) es SOLO LECTURA", () => {
  const MIG = join(ROOT, "supabase", "migrations");
  const file = readdirSync(MIG).find((f) => /tournament_category_bundle/.test(f))!;
  const sql = stripSql(read(join("supabase", "migrations", file)));

  it("no escribe (sin insert/update/delete) y no llama al motor", () => {
    expect(sql).not.toMatch(/\binsert\s+into\b/i);
    expect(sql).not.toMatch(/\bupdate\s+public\./i);
    expect(sql).not.toMatch(/\bdelete\s+from\b/i);
    for (const t of ["award_xp", "grant_fichas", "apply_tournament_result"]) expect(sql).not.toContain(t);
  });

  it("respeta visibilidad (can_access_space)", () => {
    expect(sql).toMatch(/can_access_space/);
  });
});
