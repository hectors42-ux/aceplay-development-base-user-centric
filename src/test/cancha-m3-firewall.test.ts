import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Firewall de la capa de conexión VISIBLE (M3 · buscar / perfil / reto):
 *   (a) Ninguna pantalla ni el hook llaman a recompensa o al motor
 *       (award_xp / grant_fichas / record_match / apply_*). El matchmaking SOLO
 *       sugiere; enviar reto crea un challenge 'pending' y nada más (Addendum E).
 *   (b) El perfil público respeta la condición de MENOR en la UI (Addendum D):
 *       JugadorPublico gatea por is_minor.
 *   (c) Enviar reto usa send_challenge (M1), no inserta partidos ni mueve standings.
 */

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

const FILES = [
  "src/pages/BuscarPartner.tsx",
  "src/pages/JugadorPublico.tsx",
  "src/pages/EnviarReto.tsx",
  "src/hooks/useCancha.ts",
  "src/lib/cancha-utils.ts",
];

const FORBIDDEN = ["award_xp", "grant_fichas", "record_match", "apply_match_to_ratings", "apply_ladder_result"];

describe("Firewall M3: la conexión visible no premia ni toca el motor", () => {
  for (const f of FILES) {
    const code = read(f);
    for (const token of FORBIDDEN) {
      it(`${f}: no referencia "${token}"`, () => {
        expect(code).not.toContain(token);
      });
    }
  }
});

describe("M3 · reglas de la spec en la UI", () => {
  it("EnviarReto crea el reto vía send_challenge (M1), no inserta partidos", () => {
    const code = read("src/pages/EnviarReto.tsx");
    expect(code).toMatch(/useSendChallenge/);
    // No debe llamar a ninguna RPC de resultado/standing.
    expect(code).not.toMatch(/confirm_match|create_ladder_challenge/);
  });

  it("useSendChallenge dispara send_challenge y solo refresca (no premia)", () => {
    const code = read("src/hooks/useCancha.ts");
    expect(code).toMatch(/rpc\("send_challenge"/);
  });

  it("JugadorPublico gatea por la condición de menor (Addendum D)", () => {
    const code = read("src/pages/JugadorPublico.tsx");
    expect(code).toMatch(/is_minor/);
    expect(code).toMatch(/menor/i);
  });

  it("BuscarPartner muestra el 'por qué' del match (razón) y el match%", () => {
    const code = read("src/pages/BuscarPartner.tsx");
    expect(code).toMatch(/partnerReason/);
    expect(code).toMatch(/match_pct/);
  });

  it("suggest_partners (M1): EMPATE de match% → más cercano (mismo espacio, luego cercanía)", () => {
    const { readdirSync } = require("node:fs") as typeof import("node:fs");
    const MIG = join(ROOT, "supabase", "migrations");
    const file = readdirSync(MIG).find((f) => /cancha_connection_layer/.test(f))!;
    const sql = read(join("supabase", "migrations", file));
    const order = sql.match(/order by\s+([\s\S]*?)limit greatest/i)?.[1] ?? "";
    // El orden DEBE ser: match% desc → mismo espacio primero → variedad → cercanía.
    expect(order).toMatch(/match_pct\s+desc/i);
    const sharedAt = order.search(/shared_space_id is not null\)\s*desc/i);
    const closeAt = order.search(/closeness\s+asc/i);
    expect(sharedAt).toBeGreaterThan(-1);     // tiebreak de proximidad presente
    expect(closeAt).toBeGreaterThan(sharedAt); // y la cercanía afina después
  });
});
