export type HapticLevel = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' | 'champ';

const PATTERNS: Record<HapticLevel, number[]> = {
  light:   [10],
  medium:  [20],
  heavy:   [35],
  success: [12, 40, 18],
  warning: [25, 60, 25],
  error:   [40, 80, 40, 80, 40],
  champ:   [30, 80, 30, 80, 30, 220, 70],
};

function isReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function haptic(level: HapticLevel = 'light'): void {
  if (isReducedMotion()) return;
  if (typeof window === 'undefined') return;
  const w = window as unknown as {
    webkit?: { messageHandlers?: { aceHaptic?: { postMessage: (msg: unknown) => void } } };
  };
  // 1) iOS native bridge (Capacitor / PWA wrapper)
  if (w.webkit?.messageHandlers?.aceHaptic) {
    w.webkit.messageHandlers.aceHaptic.postMessage({ level });
    return;
  }
  // 2) Android Chromium fallback — único uso permitido de navigator.vibrate en el repo.
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate(PATTERNS[level]);
  }
  // 3) iOS Safari sin wrapper → no-op silencioso
}