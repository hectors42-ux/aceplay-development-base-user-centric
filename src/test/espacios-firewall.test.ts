import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Firewall de Espacios (Épica N): la pantalla es de LECTURA/NAVEGACIÓN. El hook
 * useMySpaces solo agrega datos existentes; no escribe en rating/xp/fichas ni en
 * ninguna tabla, y no llama al motor.
 */
const ROOT = process.cwd();
const code = readFileSync(join(ROOT, "src", "hooks", "useMySpaces.ts"), "utf8");

describe("Firewall Espacios: useMySpaces solo lee", () => {
  for (const token of ["award_xp", "grant_fichas", "record_match", "apply_match_to_ratings"]) {
    it(`no referencia "${token}"`, () => expect(code).not.toContain(token));
  }
  it("no hace escrituras (insert/update/delete/upsert/rpc de escritura)", () => {
    expect(code).not.toMatch(/\.(insert|update|delete|upsert)\s*\(/);
  });
  it("reusa RPCs/tablas de lectura existentes (no crea tablas)", () => {
    expect(code).toMatch(/list_escalerillas/);
    expect(code).toMatch(/list_tournament_categories/);
    expect(code).not.toMatch(/create table/i);
  });
});
