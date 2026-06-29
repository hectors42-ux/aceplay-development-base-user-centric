// Regla del "Jugador Dominante" (reglamento, anexo). Dado el marcador al momento
// de la interrupción (set 1 cerrado + set 2 en curso, con A liderando), sugiere el
// marcador final: al ganador se le suman los juegos para llegar a 6 en el 2º set;
// al perdedor, la mitad (redondeo hacia arriba). Si el perdedor llegaría a 6+, el
// set se cierra 7-5. Es una SUGERENCIA — el organizador confirma o edita.
export interface DominantInput {
  set1A: number; set1B: number; // 1er set (A lo ganó)
  set2A: number; set2B: number; // 2do set al interrumpir (A lidera)
}
export interface DominantResult {
  set1A: number; set1B: number;
  set2A: number; set2B: number;
  ok: boolean; reason?: string;
}

export function suggestDominantScore(i: DominantInput): DominantResult {
  const base = { set1A: i.set1A, set1B: i.set1B, set2A: i.set2A, set2B: i.set2B };
  // Validación mínima de las condiciones del reglamento.
  if (i.set1A <= i.set1B) return { ...base, ok: false, reason: "El jugador A debe haber ganado el 1er set." };
  if (i.set2A <= i.set2B) return { ...base, ok: false, reason: "El jugador A debe liderar el 2º set." };
  const totalA = i.set1A + i.set2A;
  if (totalA < 10) return { ...base, ok: false, reason: "El jugador A debe sumar 10+ juegos (set 1 + set 2)." };

  const added = Math.max(0, 6 - i.set2A);           // juegos que le faltan a A para 6
  const bonus = Math.ceil(added / 2);                // mitad para el perdedor (redondeo arriba)
  let set2A = 6;
  let set2B = i.set2B + bonus;
  if (set2B >= 6) { set2A = 7; set2B = 5; }          // no existe 6-5 → 7-5
  return { set1A: i.set1A, set1B: i.set1B, set2A, set2B, ok: true };
}
