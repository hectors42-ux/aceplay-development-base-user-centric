import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Devuelve el texto correcto de una racha de partidos según el signo y la magnitud.
 * - streak > 0  → "X victoria seguida" / "X victorias seguidas"
 * - streak < 0  → "X derrota seguida" / "X derrotas seguidas"
 * - streak == 0 → "Sin racha"
 */
export function formatStreakLabel(streak: number): string {
  const n = Math.abs(streak);
  if (n === 0) return "Sin racha";
  const isWin = streak > 0;
  const noun = isWin ? "victoria" : "derrota";
  const suffix = n === 1 ? "seguida" : "seguidas";
  const plural = n === 1 ? noun : `${noun}s`;
  return `${n} ${plural} ${suffix}`;
}

/**
 * Versión compacta de la racha para badges estrechos (mobile).
 * Ej: 5 → "5V seguidas", -1 → "1D seguida"
 */
export function formatStreakLabelShort(streak: number): string {
  const n = Math.abs(streak);
  if (n === 0) return "—";
  const letter = streak > 0 ? "V" : "D";
  const suffix = n === 1 ? "seguida" : "seguidas";
  return `${n}${letter} ${suffix}`;
}

