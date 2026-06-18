import type { Database } from "@/integrations/supabase/types";

export type LadderChallengeStatus =
  Database["public"]["Enums"]["ladder_challenge_status"];

export const LADDER_CHALLENGE_STATUS_LABEL: Record<LadderChallengeStatus, string> = {
  propuesto: "Propuesto",
  aceptado: "Aceptado",
  rechazado: "Rechazado",
  programado: "Programado",
  jugado: "Jugado",
  expirado: "Expirado",
  cancelado: "Cancelado",
};

export const ladderChallengeStatusColor = (status: LadderChallengeStatus) => {
  switch (status) {
    case "propuesto":
      return "bg-warning/15 text-warning-foreground border-warning/30";
    case "aceptado":
    case "programado":
      return "bg-accent/15 text-accent border-accent/30";
    case "jugado":
      return "bg-success/15 text-success border-success/30";
    case "rechazado":
    case "expirado":
    case "cancelado":
    default:
      return "bg-muted text-muted-foreground border-border";
  }
};

/**
 * Días restantes de cooldown contra un oponente específico.
 * Devuelve 0 si no hay cooldown activo.
 */
export const cooldownDaysRemaining = (
  lastPlayedAt: string | null,
  cooldownDays: number,
): number => {
  if (!lastPlayedAt || cooldownDays <= 0) return 0;
  const last = new Date(lastPlayedAt).getTime();
  const next = last + cooldownDays * 24 * 60 * 60 * 1000;
  const diffMs = next - Date.now();
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / (24 * 60 * 60 * 1000));
};

/**
 * Determina si una posición (challenged) es alcanzable desde la mía
 * según max_position_jump. Sólo se puede desafiar a jugadores con MEJOR posición
 * (número menor) y dentro del rango.
 */
export const isReachable = (
  myPosition: number,
  targetPosition: number,
  maxJump: number,
): boolean => {
  if (targetPosition >= myPosition) return false;
  return myPosition - targetPosition <= maxJump;
};
