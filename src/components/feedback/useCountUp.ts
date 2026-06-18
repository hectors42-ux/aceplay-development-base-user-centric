import { useEffect, useState } from 'react';

interface Options {
  duration?: number;
  decimals?: number;
  start?: number;
}

export function useCountUp(target: number, opts: Options = {}): string | number {
  const { duration = 800, decimals = 0, start = 0 } = opts;
  const reduced =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [v, setV] = useState<number>(reduced ? target : start);

  useEffect(() => {
    if (reduced) {
      setV(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setV(start + (target - start) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, start, reduced]);

  return decimals > 0 ? v.toFixed(decimals) : Math.round(v);
}