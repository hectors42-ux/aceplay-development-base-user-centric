import { describe, it, expect } from "vitest";
import {
  DEFAULT_PROFILE,
  matchWinner,
  validateScore,
  type ScoringProfile,
  type SetScore,
} from "@/lib/scoring-profile";

const profileBo3SuperTb: ScoringProfile = { ...DEFAULT_PROFILE };
const profile1SetGolden: ScoringProfile = {
  ...DEFAULT_PROFILE,
  sets: 1,
  final_set: "normal",
  golden_point: true,
};
const profileWinByGames: ScoringProfile = {
  ...DEFAULT_PROFILE,
  win_by: "games",
};
const profileTime: ScoringProfile = {
  ...DEFAULT_PROFILE,
  sets: 1,
  final_set: "normal",
  termination: "time",
};

describe("scoring-profile validateScore", () => {
  it("acepta bo3 + super_tb10 con 6-4, 7-6(5), 10-8", () => {
    const score: SetScore[] = [
      { a: 6, b: 4, kind: "set" },
      { a: 7, b: 6, tb_a: 7, tb_b: 5, kind: "set" },
      { a: 10, b: 8, kind: "super_tb" },
    ];
    expect(validateScore(score, profileBo3SuperTb).ok).toBe(true);
    expect(matchWinner(score, profileBo3SuperTb)).toBe("a");
  });

  it("rechaza 6-4, 4-6, 6-3 cuando el set 3 debe ser súper-TB", () => {
    const score: SetScore[] = [
      { a: 6, b: 4, kind: "set" },
      { a: 4, b: 6, kind: "set" },
      { a: 6, b: 3, kind: "set" },
    ];
    const res = validateScore(score, profileBo3SuperTb);
    expect(res.ok).toBe(false);
    if (res.ok === false) expect(res.error).toMatch(/súper tie-break/i);
  });

  it("acepta 1 set + golden point con 6-4", () => {
    const score: SetScore[] = [{ a: 6, b: 4, kind: "set" }];
    expect(validateScore(score, profile1SetGolden).ok).toBe(true);
    expect(matchWinner(score, profile1SetGolden)).toBe("a");
  });

  it("win_by='games' corona por juegos totales", () => {
    const score: SetScore[] = [
      { a: 5, b: 7, kind: "set" },
      { a: 6, b: 3, kind: "set" },
      { a: 6, b: 4, kind: "set" },
    ];
    // games totales: a=17, b=14 → a
    expect(matchWinner(score, profileWinByGames)).toBe("a");
  });

  it("termination='time' acepta marcador parcial", () => {
    const score: SetScore[] = [{ a: 4, b: 3, kind: "set" }];
    expect(validateScore(score, profileTime).ok).toBe(true);
    expect(matchWinner(score, profileTime)).toBe("a");
  });
});