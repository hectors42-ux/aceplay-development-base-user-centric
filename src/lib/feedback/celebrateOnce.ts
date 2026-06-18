import type { CelebrationProps } from '@/components/feedback/CelebrationOverlay';

type CelebrateFn = (props: Omit<CelebrationProps, 'onClose'>) => void;

/**
 * Dispara una celebración `major` UNA sola vez por sesión para una clave dada.
 *
 * Casos típicos:
 *   - subir de posición en standings: key = `pos:${tournamentId}:${from}:${to}`
 *   - clasificar a playoff: key = `playoff:${tournamentId}:${categoryId}`
 *
 * El flag vive en `sessionStorage` con prefijo `celeb:` (Protocolo QA §6.5.2).
 */
export function celebrateMajorOnce(
  celebrate: CelebrateFn,
  key: string,
  props: Omit<CelebrationProps, 'onClose' | 'kind'>,
): boolean {
  const flag = `celeb:${key}`;
  try {
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(flag)) {
      return false;
    }
    sessionStorage?.setItem(flag, '1');
  } catch {
    /* sessionStorage bloqueado (modo privado) — caemos al disparo igual */
  }
  celebrate({ kind: 'major', ...props });
  return true;
}

/** Limpia todos los flags de celebración de la sesión actual. Útil en DEV/QA. */
export function clearCelebrationFlags() {
  try {
    Object.keys(sessionStorage)
      .filter((k) => k.startsWith('celeb:'))
      .forEach((k) => sessionStorage.removeItem(k));
    Object.keys(localStorage)
      .filter((k) => k.startsWith('celebrated:'))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    /* noop */
  }
}