// Fórmula de puntaje ponderado del round-robin (reglamento Club Providencia).
// ESPEJO EXACTO del RPC public.round_robin_standings
// (supabase/migrations/20260630120000_round_robin_weighted_roster.sql).
// Si cambias uno, cambia el otro.
//
//   Puntaje = PG×1.0 + Sets×0.1 + Juegos×0.01 + PuntosST×0.001
//   · sets_ganados   = sets donde el jugador hizo más games/puntos.
//   · juegos_ganados = games del jugador en sets NORMALES (is_tiebreak=false).
//   · puntos_st      = puntos del jugador en sets SUPER TB (is_tiebreak=true) — el 3er set.
//
// Desempate (en orden): 1) PG · 2) Sets · 3) Juegos · 4) Juegos STB · 5) Duelo directo.

export interface RRSet {
  games_a: number;
  games_b: number;
  is_tiebreak?: boolean;
}
export interface RRMatch {
  player_a: string;
  player_b: string;
  winner: string | null;
  sets: RRSet[];
}
export interface RRParticipant {
  id: string;
  display_name: string;
  source?: string;
}
export interface RRStanding extends RRParticipant {
  partidos_jugados: number;
  partidos_ganados: number;
  sets_ganados: number;
  juegos_ganados: number;
  puntos_st: number;
  puntaje: number;
}

export function roundRobinScore(pg: number, sets: number, juegos: number, puntosSt: number): number {
  // toFixed(3) evita el ruido de coma flotante (0.1 + 0.2…). Mismo orden de magnitud que el RPC.
  return Number((pg * 1.0 + sets * 0.1 + juegos * 0.01 + puntosSt * 0.001).toFixed(3));
}

export function roundRobinStandings(participants: RRParticipant[], matches: RRMatch[]): RRStanding[] {
  const rows: RRStanding[] = participants.map((p) => {
    let pj = 0, pg = 0, sg = 0, jg = 0, st = 0;
    for (const m of matches) {
      const isA = m.player_a === p.id;
      const isB = m.player_b === p.id;
      if (!isA && !isB) continue;
      pj += 1;
      if (m.winner === p.id) pg += 1;
      for (const s of m.sets) {
        const mine = isA ? s.games_a : s.games_b;
        const opp = isA ? s.games_b : s.games_a;
        if (mine > opp) sg += 1;
        if (s.is_tiebreak) st += mine;
        else jg += mine;
      }
    }
    return {
      ...p,
      partidos_jugados: pj,
      partidos_ganados: pg,
      sets_ganados: sg,
      juegos_ganados: jg,
      puntos_st: st,
      puntaje: roundRobinScore(pg, sg, jg, st),
    };
  });

  // 5º desempate · duelo directo: victorias contra rivales empatados en los 4 niveles.
  const tiedKey = (r: RRStanding) => `${r.partidos_ganados}|${r.sets_ganados}|${r.juegos_ganados}|${r.puntos_st}`;
  const byId = new Map(rows.map((r) => [r.id, r]));
  const h2h = (r: RRStanding) =>
    matches.filter((m) => {
      if (m.winner !== r.id) return false;
      const oppId = m.player_a === r.id ? m.player_b : m.player_a;
      const o = byId.get(oppId);
      return !!o && tiedKey(o) === tiedKey(r);
    }).length;

  return [...rows].sort(
    (a, b) =>
      b.partidos_ganados - a.partidos_ganados ||
      b.sets_ganados - a.sets_ganados ||
      b.juegos_ganados - a.juegos_ganados ||
      b.puntos_st - a.puntos_st ||
      h2h(b) - h2h(a) ||
      a.display_name.localeCompare(b.display_name),
  );
}
