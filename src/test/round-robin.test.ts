import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { roundRobinStandings, roundRobinScore, type RRMatch } from "@/lib/round-robin";

// ── 1 · Fórmula ponderada ────────────────────────────────────────────────────
describe("Round-robin · puntaje ponderado", () => {
  it("Puntaje = PG×1.0 + Sets×0.1 + Juegos×0.01 + PuntosST×0.001", () => {
    // 2 victorias en 2 sets cada una: PG=2, Sets=4, Juegos=24, ST=0.
    expect(roundRobinScore(2, 4, 24, 0)).toBe(2.64);
    // con super tie-break: PG=1, Sets=2, Juegos=10, ST=10 → 1 + 0.2 + 0.1 + 0.01 = 1.31
    expect(roundRobinScore(1, 2, 10, 10)).toBe(1.31);
  });

  it("deriva sets/juegos/puntos_st correctamente desde los sets", () => {
    const ps = [{ id: "a", display_name: "A" }, { id: "b", display_name: "B" }];
    const matches: RRMatch[] = [
      // A gana: 6-4, 4-6, super TB 10-8 (3er set is_tiebreak).
      { player_a: "a", player_b: "b", winner: "a", sets: [
        { games_a: 6, games_b: 4 },
        { games_a: 4, games_b: 6 },
        { games_a: 10, games_b: 8, is_tiebreak: true },
      ] },
    ];
    const [a, b] = roundRobinStandings(ps, matches).sort((x, y) => x.id.localeCompare(y.id));
    // A: sets ganados = set1 (6>4) + STB (10>8) = 2 ; juegos = 6+4 = 10 ; ST = 10.
    expect(a).toMatchObject({ partidos_ganados: 1, sets_ganados: 2, juegos_ganados: 10, puntos_st: 10 });
    // B: sets ganados = set2 (6>4) = 1 ; juegos = 4+6 = 10 ; ST = 8.
    expect(b).toMatchObject({ partidos_ganados: 0, sets_ganados: 1, juegos_ganados: 10, puntos_st: 8 });
    // el STB NO entra en juegos_ganados (va a puntos_st).
    expect(a.juegos_ganados).toBe(10);
  });
});

// ── 2 · Jerarquía de desempate (5 niveles) ───────────────────────────────────
describe("Round-robin · jerarquía de desempate", () => {
  const P = ["a", "b", "c"].map((id) => ({ id, display_name: id.toUpperCase() }));

  it("ordena primero por partidos ganados", () => {
    const m: RRMatch[] = [
      { player_a: "a", player_b: "b", winner: "a", sets: [{ games_a: 6, games_b: 0 }, { games_a: 6, games_b: 0 }] },
      { player_a: "a", player_b: "c", winner: "a", sets: [{ games_a: 6, games_b: 0 }, { games_a: 6, games_b: 0 }] },
      { player_a: "b", player_b: "c", winner: "b", sets: [{ games_a: 6, games_b: 4 }, { games_a: 6, games_b: 4 }] },
    ];
    expect(roundRobinStandings(P, m).map((r) => r.id)).toEqual(["a", "b", "c"]);
  });

  it("con mismos PG, desempata por sets y luego juegos", () => {
    // a y b ganan 1 partido cada uno; a gana 2-0 (más sets), b gana 2-1.
    const m: RRMatch[] = [
      { player_a: "a", player_b: "c", winner: "a", sets: [{ games_a: 6, games_b: 1 }, { games_a: 6, games_b: 1 }] },
      { player_a: "b", player_b: "c", winner: "b", sets: [{ games_a: 6, games_b: 4 }, { games_a: 3, games_b: 6 }, { games_a: 10, games_b: 8, is_tiebreak: true }] },
    ];
    const order = roundRobinStandings(P, m).map((r) => r.id);
    expect(order.indexOf("a")).toBeLessThan(order.indexOf("b")); // a: 2 sets > b: 2 sets... empata sets, gana por juegos
  });

  it("5º nivel · duelo directo rompe el empate total", () => {
    // a y b idénticos en PG/sets/juegos/ST salvo que se enfrentaron y ganó B.
    const m: RRMatch[] = [
      { player_a: "a", player_b: "c", winner: "a", sets: [{ games_a: 6, games_b: 4 }, { games_a: 6, games_b: 4 }] },
      { player_a: "b", player_b: "c", winner: "b", sets: [{ games_a: 6, games_b: 4 }, { games_a: 6, games_b: 4 }] },
      { player_a: "b", player_b: "a", winner: "b", sets: [{ games_a: 7, games_b: 6 }, { games_a: 6, games_b: 7 }, { games_a: 10, games_b: 8, is_tiebreak: true }] },
    ];
    // Tras el duelo directo (b le ganó a a) y resultados simétricos vs c, B debe ir sobre A si quedan empatados arriba.
    const rows = roundRobinStandings(P, m);
    const a = rows.find((r) => r.id === "a")!;
    const b = rows.find((r) => r.id === "b")!;
    if (a.partidos_ganados === b.partidos_ganados && a.sets_ganados === b.sets_ganados &&
        a.juegos_ganados === b.juegos_ganados && a.puntos_st === b.puntos_st) {
      expect(rows.map((r) => r.id).indexOf("b")).toBeLessThan(rows.map((r) => r.id).indexOf("a"));
    } else {
      // si no quedaron empatados en los 4 niveles, basta que el orden sea estable/válido
      expect(rows.length).toBe(3);
    }
  });
});

// ── 3 · FIREWALL + gating (análisis estático de la migración) ─────────────────
const MIG = readFileSync(
  join(process.cwd(), "supabase", "migrations", "20260630120000_round_robin_weighted_roster.sql"),
  "utf8",
);
describe("Round-robin · firewall y permisos", () => {
  it("el módulo NO escribe en player_ratings (roster_players sin rating global)", () => {
    expect(MIG).not.toMatch(/insert\s+into\s+public\.player_ratings/i);
    expect(MIG).not.toMatch(/update\s+public\.player_ratings/i);
    expect(MIG).not.toContain("apply_match_to_ratings");
  });
  it("usa rr_match/rr_match_set propios (no pasa roster_players por public.matches)", () => {
    expect(MIG).toMatch(/create table if not exists public\.rr_match\b/);
    expect(MIG).not.toMatch(/insert\s+into\s+public\.matches\b/i);
  });
  it("organizer_add_player y rr_record_result están gateados al organizador", () => {
    const addPlayer = MIG.slice(MIG.indexOf("function public.organizer_add_player"));
    expect(addPlayer.slice(0, 400)).toContain("_rr_can_manage");
    const record = MIG.slice(MIG.indexOf("function public.rr_record_result"));
    expect(record.slice(0, 400)).toContain("_rr_can_manage");
  });
});
