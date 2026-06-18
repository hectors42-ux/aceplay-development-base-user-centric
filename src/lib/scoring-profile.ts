/**
 * PRD 8 — Perfil de scoring parametrizable por categoría.
 *
 * El perfil define CÓMO se cuenta un partido (sets, tie-breaks, golden point,
 * win_by, terminación). Es independiente del motor: sirve igual en bracket o
 * en round robin, y produce los insumos que necesita `match_observation`
 * (detalle de sets + ganador del partido).
 *
 * NO hardcodear reglas de ningún club acá: el validador es genérico y lee el
 * profile que cada categoría persiste en `tournament_categories.config.scoring`.
 */

import type { SetScore } from "@/lib/tournament-utils";

export type SetKind = "set" | "super_tb";
export type { SetScore };

export type ScoringProfile = {
  sets: 1 | 3 | 5;
  games_per_set: 4 | 6 | 9;
  set_tb: "tb7" | "ventaja" | "tb7_dif2";
  final_set: "normal" | "super_tb10" | "ventaja";
  golden_point: boolean;
  win_by: "sets" | "games";
  termination: "score" | "time";
};

export const DEFAULT_PROFILE: ScoringProfile = {
  sets: 3,
  games_per_set: 6,
  set_tb: "tb7",
  final_set: "super_tb10",
  golden_point: false,
  win_by: "sets",
  termination: "score",
};

const SET_KIND = (s: SetScore): SetKind => s.kind ?? "set";

/** Cuenta sets ganados por A y B (sólo cuenta `kind='set'`). */
export function countSets(score: SetScore[]): { a: number; b: number } {
  let a = 0;
  let b = 0;
  for (const s of score) {
    if (SET_KIND(s) !== "set") continue;
    if (s.a > s.b) a++;
    else if (s.b > s.a) b++;
  }
  return { a, b };
}

/** Cuenta games totales: separa games normales de puntos de super-TB. */
export function countGames(score: SetScore[]): {
  a: number;
  b: number;
  stb_a: number;
  stb_b: number;
} {
  let a = 0;
  let b = 0;
  let stb_a = 0;
  let stb_b = 0;
  for (const s of score) {
    if (SET_KIND(s) === "super_tb") {
      stb_a += s.a;
      stb_b += s.b;
    } else {
      a += s.a;
      b += s.b;
    }
  }
  return { a, b, stb_a, stb_b };
}

/**
 * Determina el ganador del partido según el perfil. Para super_tb decisorios
 * (kind='super_tb' al final), si win_by='sets' el set cuenta como 1.
 */
export function matchWinner(
  score: SetScore[],
  profile: ScoringProfile,
): "a" | "b" | null {
  if (!score.length) return null;
  if (profile.win_by === "games") {
    const g = countGames(score);
    const totalA = g.a + (g.stb_a > g.stb_b ? 1 : 0);
    const totalB = g.b + (g.stb_b > g.stb_a ? 1 : 0);
    if (totalA === totalB) return null;
    return totalA > totalB ? "a" : "b";
  }
  // win_by='sets': cuenta sets normales + el super-TB final como 1 set.
  const sets = countSets(score);
  let a = sets.a;
  let b = sets.b;
  for (const s of score) {
    if (SET_KIND(s) === "super_tb") {
      if (s.a > s.b) a++;
      else if (s.b > s.a) b++;
    }
  }
  if (a === b) return null;
  return a > b ? "a" : "b";
}

export type ValidationResult = { ok: true } | { ok: false; error: string };

const OK: ValidationResult = { ok: true };
const err = (m: string): ValidationResult => ({ ok: false, error: m });

/**
 * Valida si un set NORMAL es correcto según el perfil.
 * Reglas:
 *  - El ganador llega a `games_per_set` con diferencia ≥ 2,
 *    salvo `set_tb='tb7'` que permite 7-6 con TB cargado.
 *  - `set_tb='ventaja'`: no se acepta TB; debe haber dif ≥ 2.
 *  - `set_tb='tb7_dif2'`: el TB debe tener dif ≥ 2 (variantes con dif≥2 explícita).
 */
function validateNormalSet(s: SetScore, p: ScoringProfile, idx: number): ValidationResult {
  const meta = p.games_per_set;
  const max = s.a > s.b ? s.a : s.b;
  const min = s.a > s.b ? s.b : s.a;

  // Caso TB en 7-6 (sólo cuando meta=6 y set_tb permite TB)
  const isTbEdge = meta === 6 && ((s.a === 7 && s.b === 6) || (s.a === 6 && s.b === 7));
  if (isTbEdge) {
    if (p.set_tb === "ventaja") {
      return err(`Set ${idx + 1}: este formato no permite tie-break, debe ganarse por dos.`);
    }
    if (s.tb_a == null && s.tb_b == null && s.tb == null) {
      return err(`Set ${idx + 1}: falta el marcador del tie-break.`);
    }
    if (s.tb_a != null && s.tb_b != null) {
      const tbMax = Math.max(s.tb_a, s.tb_b);
      const tbDiff = Math.abs(s.tb_a - s.tb_b);
      if (tbMax < 7) return err(`Set ${idx + 1}: el tie-break debe llegar al menos a 7.`);
      if (tbDiff < 2) return err(`Set ${idx + 1}: el tie-break debe ganarse por dos.`);
    }
    return OK;
  }

  if (max < meta) {
    return err(`Set ${idx + 1}: el ganador debe llegar al menos a ${meta} juegos.`);
  }
  if (max - min < 2) {
    return err(`Set ${idx + 1}: debe ganarse con diferencia de 2 juegos.`);
  }
  return OK;
}

function validateSuperTb(s: SetScore, p: ScoringProfile, idx: number): ValidationResult {
  const max = Math.max(s.a, s.b);
  const diff = Math.abs(s.a - s.b);
  if (max < 10) return err(`El set ${idx + 1} debe ser súper tie-break a 10.`);
  if (diff < 2) return err(`El set ${idx + 1} (súper tie-break) debe ganarse por dos.`);
  return OK;
}

/**
 * Valida el score completo contra el perfil. Devuelve mensaje claro y
 * accionable cuando falla (apuntando al set ofensor).
 */
export function validateScore(
  score: SetScore[],
  profile: ScoringProfile,
): ValidationResult {
  if (!score.length) return err("Cargá al menos un set jugado.");
  if (score.length > profile.sets) {
    return err(`Este formato admite máximo ${profile.sets} sets.`);
  }

  for (let i = 0; i < score.length; i++) {
    const s = score[i];
    if (!Number.isInteger(s.a) || !Number.isInteger(s.b) || s.a < 0 || s.b < 0) {
      return err(`Set ${i + 1}: marcador inválido.`);
    }
    if (s.a === s.b && SET_KIND(s) === "set") {
      return err(`Set ${i + 1}: no puede terminar empatado.`);
    }
    const isLast = i === profile.sets - 1;
    const expectedKind: SetKind =
      isLast && profile.final_set === "super_tb10" ? "super_tb" : "set";

    if (profile.termination === "time") {
      // Por tiempo: aceptamos el marcador tal como llega siempre que tenga ganador.
      if (s.a === s.b) return err(`Set ${i + 1}: el marcador final no puede estar empatado.`);
      continue;
    }

    if (expectedKind === "super_tb") {
      if (SET_KIND(s) !== "super_tb") {
        return err(`El set ${i + 1} debe ser súper tie-break a 10, dif. 2.`);
      }
      const v = validateSuperTb(s, profile, i);
      if (!v.ok) return v;
    } else {
      if (SET_KIND(s) === "super_tb") {
        return err(`Set ${i + 1}: no corresponde súper tie-break en esta posición.`);
      }
      const v = validateNormalSet(s, profile, i);
      if (!v.ok) return v;
    }
  }

  // Mayoría / ganador definido
  if (profile.win_by === "sets") {
    const needed = Math.ceil(profile.sets / 2);
    // Cuenta sets + super-TB final como 1 set
    let a = 0;
    let b = 0;
    for (const s of score) {
      if (s.a > s.b) a++;
      else if (s.b > s.a) b++;
    }
    if (Math.max(a, b) < needed && score.length === profile.sets) {
      return err(`Nadie alcanzó los ${needed} sets necesarios.`);
    }
    if (a === b) return err("El partido no puede terminar empatado.");
  } else {
    const w = matchWinner(score, profile);
    if (!w) return err("Por juegos totales el partido no puede terminar empatado.");
  }

  return OK;
}

/**
 * Resuelve el profile efectivo de una categoría. Mergea sobre DEFAULT_PROFILE
 * y, si la categoría aún no persistió `config.scoring`, deriva un profile
 * a partir de los knobs legacy (`config.knobs.scoring`/`bestOf`).
 */
export function resolveScoringProfile(
  category: { config?: unknown } | null | undefined,
): ScoringProfile {
  const cfg = (category?.config ?? null) as
    | { scoring?: Partial<ScoringProfile>; knobs?: { scoring?: string; bestOf?: number } }
    | null;

  if (cfg?.scoring && typeof cfg.scoring === "object") {
    return { ...DEFAULT_PROFILE, ...cfg.scoring } as ScoringProfile;
  }

  const legacy = cfg?.knobs;
  if (!legacy) return DEFAULT_PROFILE;

  // Derivación heurística desde el preset legacy.
  const sets: 1 | 3 | 5 = legacy.bestOf === 1 ? 1 : legacy.bestOf === 5 ? 5 : 3;
  switch (legacy.scoring) {
    case "sets_1_de_3":
      return { ...DEFAULT_PROFILE, sets: 1, final_set: "normal" };
    case "pro_set_8":
      return {
        ...DEFAULT_PROFILE,
        sets: 1,
        games_per_set: 9, // pro set a 8 con dif 2 → meta 9 cumple "llega al menos a 8" si lo flexibilizamos
        final_set: "normal",
      };
    case "tiebreak_10":
      return {
        ...DEFAULT_PROFILE,
        sets: 1,
        final_set: "super_tb10",
      };
    case "sets_2_de_3":
    default:
      return { ...DEFAULT_PROFILE, sets };
  }
}