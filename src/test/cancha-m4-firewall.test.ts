import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Firewall de los llamados abiertos (M4 · disponibilidad + feed):
 *   (a) Publicar o tomar un llamado NO premia (las pantallas/hooks no llaman
 *       award_xp/grant_fichas/record_match). Tomar crea la agenda vía la RPC M1.
 *   (b) availability_feed es SOLO LECTURA y aplica el guard de menor (Addendum D):
 *       un menor no aparece en el feed público.
 *   (c) Tomar es first-come: la UI dispara take_availability (atómico en M1) y el
 *       hook maneja el rechazo del segundo con un toast de error.
 */

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const stripSql = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").map((l) => l.replace(/--.*$/, "")).join("\n");

const PAGES = ["src/pages/LanzarDisponibilidad.tsx", "src/pages/Llamados.tsx", "src/hooks/useCancha.ts"];
const FORBIDDEN = ["award_xp", "grant_fichas", "record_match", "apply_match_to_ratings", "apply_ladder_result"];

describe("Firewall M4: los llamados no premian ni tocan el motor", () => {
  for (const f of PAGES) {
    const code = read(f);
    for (const token of FORBIDDEN) {
      it(`${f}: no referencia "${token}"`, () => expect(code).not.toContain(token));
    }
  }

  it("Llamados toma vía take_availability (first-come) y publica vía post/availability_feed", () => {
    const code = read("src/hooks/useCancha.ts");
    expect(code).toMatch(/rpc\("take_availability"/);
    expect(code).toMatch(/rpc\("post_availability"/);
    expect(code).toMatch(/rpc\("availability_feed"/);
    // El rechazo del segundo (ya tomado) se maneja con gracia (toast de error).
    expect(code).toMatch(/No se pudo tomar el llamado/);
  });
});

describe("availability_feed (M4) es solo lectura + guard de menor (Addendum D)", () => {
  const MIG = join(ROOT, "supabase", "migrations");
  const file = readdirSync(MIG).find((f) => /cancha_availability_feed/.test(f))!;
  const sql = stripSql(read(join("supabase", "migrations", file)));

  it("no escribe nada (sin insert/update/delete)", () => {
    expect(sql).not.toMatch(/\binsert\s+into\b/i);
    expect(sql).not.toMatch(/\bupdate\s+public\./i);
    expect(sql).not.toMatch(/\bdelete\s+from\b/i);
  });

  it("excluye al menor del feed público (is_minor manda)", () => {
    expect(sql).toMatch(/is_minor\s*\(/i);
    expect(sql).toMatch(/pf\.id\s*<>\s*auth\.uid\(\)/i);
  });
});
