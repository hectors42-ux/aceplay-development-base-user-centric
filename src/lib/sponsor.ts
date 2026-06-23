// Resolver de presencia de marca, DETERMINÍSTICO y testeable. Orden de victoria:
//   1) prioridad pagada (paid_priority)  2) prioridad manual  3) weight
//   4) rotación round-robin estable por ventana entre los EMPATADOS.
// La parte pura (resolveSponsor) no depende de la fecha: recibe `windowKey`.

export interface SponsorCandidate {
  placement_id: string;
  brand_id: string;
  brand_name: string;
  logo_url: string | null;
  hero_url: string | null;
  slot: string;
  priority: number;
  paid_priority: boolean;
  weight: number;
}

/** Clave de ventana semanal estable (rota la rotación cada semana). */
export const currentWindowKey = (epochMs: number): number =>
  Math.floor(epochMs / (7 * 24 * 60 * 60 * 1000));

/**
 * Elige el placement ganador. Entre los que empatan en
 * (paid_priority, priority, weight), rota de forma estable según `windowKey`.
 */
export function resolveSponsor(candidates: SponsorCandidate[], windowKey: number): SponsorCandidate | null {
  if (!candidates.length) return null;
  const sorted = [...candidates].sort((a, b) =>
    (Number(b.paid_priority) - Number(a.paid_priority)) ||
    (b.priority - a.priority) ||
    (b.weight - a.weight) ||
    (a.placement_id < b.placement_id ? -1 : a.placement_id > b.placement_id ? 1 : 0));
  const top = sorted[0];
  // Empatados con el tope en los tres criterios → candidatos a rotar.
  const tied = sorted.filter(
    (c) => c.paid_priority === top.paid_priority && c.priority === top.priority && c.weight === top.weight,
  );
  const idx = ((windowKey % tied.length) + tied.length) % tied.length;
  return tied[idx];
}
