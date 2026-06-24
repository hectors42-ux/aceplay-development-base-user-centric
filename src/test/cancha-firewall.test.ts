import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Firewall de la sección Cancha (capa de CONEXIÓN):
 *   (a) Las RPCs de conexión (suggest_partners, post/take_availability,
 *       send/respond_challenge, compute_ascension_path, get_public_profile, agenda)
 *       NUNCA ESCRIBEN en rating/xp/fichas/escalafón/standings, ni llaman al motor.
 *       — Se valida por ESCRITURA (no por mención): estas RPCs LEEN player_ratings /
 *         points_ledger legítimamente; lo prohibido es escribirlos o premiar.
 *   (b) compute_ascension_path es SOLO LECTURA (Addendum A): sin insert/update/delete.
 *   (c) take_availability y respond_challenge('accept') son ATÓMICOS (lock de fila).
 *   (d) La agenda NO incluye torneos (Addendum B) y deja el TODO aditivo.
 *   (e) La privacidad del perfil público REUSA is_minor() (Addendum D).
 */

const ROOT = process.cwd();
const MIG_DIR = join(ROOT, "supabase", "migrations");

const stripSqlComments = (sql: string) =>
  sql.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").map((l) => l.replace(/--.*$/, "")).join("\n");

const canchaFiles = readdirSync(MIG_DIR).filter((f) => /cancha_/.test(f));
const connectionFile = canchaFiles.find((f) => /connection_layer/.test(f))!;
const connectionSql = stripSqlComments(readFileSync(join(MIG_DIR, connectionFile), "utf8"));

// Escrituras prohibidas a las tablas/funciones del MOTOR (premio/rating/standings).
const FORBIDDEN_WRITES = [
  /insert\s+into\s+public\.player_ratings/i,
  /update\s+public\.player_ratings/i,
  /insert\s+into\s+public\.rating_history/i,
  /insert\s+into\s+public\.points_ledger/i,
  /update\s+public\.points_ledger/i,
  /insert\s+into\s+public\.xp_ledger/i,
  /insert\s+into\s+public\.fichas_ledger/i,
  /update\s+public\.space_standing/i,
  /insert\s+into\s+public\.space_standing/i,
];
// Llamadas al motor / a las RPCs que premian o mueven rating/standings.
const FORBIDDEN_CALLS = [
  /\baward_xp\s*\(/i,
  /\bgrant_fichas\s*\(/i,
  /\bapply_match_to_ratings\s*\(/i,
  /\bapply_ladder_result\s*\(/i,
  /\brecord_match\s*\(/i, // la materialización del partido es de M5 (carga de resultado), no de la capa de conexión
];

describe("Firewall Cancha: la conexión no toca el motor (rating/xp/fichas/standings)", () => {
  it("existe la migración de la capa de conexión", () => {
    expect(connectionFile).toBeTruthy();
  });

  for (const re of FORBIDDEN_WRITES) {
    it(`no escribe en el motor: ${re.source}`, () => {
      expect(connectionSql).not.toMatch(re);
    });
  }

  for (const re of FORBIDDEN_CALLS) {
    it(`no llama al motor/recompensa: ${re.source}`, () => {
      expect(connectionSql).not.toMatch(re);
    });
  }

  it("LEE el escalafón para el camino de ascenso (lectura permitida)", () => {
    // El firewall es por escritura: leer player_ratings/points_ledger es válido.
    expect(connectionSql).toMatch(/player_ratings/);
    expect(connectionSql).toMatch(/function\s+public\.compute_ascension_path/);
  });
});

describe("Addendum A · compute_ascension_path es SOLO LECTURA", () => {
  it("no contiene insert/update/delete dentro de su cuerpo", () => {
    const m = connectionSql.match(/function\s+public\.compute_ascension_path[\s\S]*?\$\$;/i);
    expect(m).toBeTruthy();
    const body = m![0];
    expect(body).not.toMatch(/\binsert\s+into\b/i);
    expect(body).not.toMatch(/\bupdate\s+public\./i);
    expect(body).not.toMatch(/\bdelete\s+from\b/i);
  });

  it("points_needed sale del umbral exacto (nivel_to_rating) y est_wins es aproximado", () => {
    expect(connectionSql).toMatch(/nivel_to_rating/);
    expect(connectionSql).toMatch(/est_basis/);
  });
});

describe("Atomicidad first-come (lock de fila)", () => {
  it("take_availability bloquea la fila (for update) antes de marcar 'taken'", () => {
    const m = connectionSql.match(/function\s+public\.take_availability[\s\S]*?\$\$;/i);
    expect(m).toBeTruthy();
    expect(m![0]).toMatch(/for update/i);
  });

  it("respond_challenge bloquea la fila (for update) para 'accept'", () => {
    const m = connectionSql.match(/function\s+public\.respond_challenge[\s\S]*?\$\$;/i);
    expect(m).toBeTruthy();
    expect(m![0]).toMatch(/for update/i);
  });
});

describe("Addendum B · la agenda arranca SIN torneos", () => {
  it("get_match_agenda no referencia tablas de torneo", () => {
    const m = connectionSql.match(/function\s+public\.get_match_agenda[\s\S]*?\$\$;/i);
    expect(m).toBeTruthy();
    expect(m![0]).not.toMatch(/tournament_bracket|tournament_config/i);
  });

  it("deja el TODO aditivo para sumar torneos al cablear la vitrina", () => {
    const raw = readFileSync(join(MIG_DIR, connectionFile), "utf8");
    expect(raw).toMatch(/TODO:.*torneo/i);
  });
});

describe("Addendum D · la privacidad del perfil público reusa is_minor()", () => {
  it("get_public_profile deriva la condición de menor de is_minor (no crea flag propio)", () => {
    const m = connectionSql.match(/function\s+public\.get_public_profile[\s\S]*?\$\$;/i);
    expect(m).toBeTruthy();
    expect(m![0]).toMatch(/is_minor\s*\(/i);
    // Un menor fuerza todas las preferencias a oculto.
    expect(m![0]).toMatch(/_minor\s+then/i);
  });

  it("profile_privacy NO define su propia columna de menor", () => {
    const m = connectionSql.match(/create table if not exists public\.profile_privacy[\s\S]*?\);/i);
    expect(m).toBeTruthy();
    expect(m![0]).not.toMatch(/minor|menor|birthdate|edad|age/i);
  });
});

describe("Addendum E · el matchmaking solo sugiere (no premia)", () => {
  it("suggest_partners no otorga XP/Fichas ni escribe nada", () => {
    const m = connectionSql.match(/function\s+public\.suggest_partners[\s\S]*?\$\$;/i);
    expect(m).toBeTruthy();
    const body = m![0];
    expect(body).not.toMatch(/\binsert\s+into\b/i);
    expect(body).not.toMatch(/\baward_xp\b|\bgrant_fichas\b/i);
  });
});
