import { useEffect, useRef } from 'react';

interface Props {
  kind?: 'major' | 'epic';
  duration?: number;
  density?: number;
}

export function Confetti({ kind = 'major', duration, density }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;
    const cv = ref.current;
    if (!cv) return;

    const dur = duration ?? (kind === 'epic' ? 3400 : 2200);
    const N = density ?? (kind === 'epic' ? 130 : 80);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = cv.clientWidth;
    const h = cv.clientHeight;
    cv.width = w * dpr;
    cv.height = h * dpr;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const colors =
      kind === 'epic'
        ? ['#c5573a', '#e0a44a', '#f4d35e', '#fff7e3', '#7aa67a']
        : ['#c5573a', '#e0a44a', '#f4d35e', '#fff7e3'];

    const parts = Array.from({ length: N }, () => ({
      x: w * (0.4 + Math.random() * 0.2),
      y: h * 0.22,
      vx: (Math.random() - 0.5) * 7,
      vy: -(Math.random() * 9 + 5),
      g: 0.22 + Math.random() * 0.08,
      a: Math.random() * Math.PI * 2,
      va: (Math.random() - 0.5) * 0.4,
      s: Math.random() * 5 + (kind === 'epic' ? 5 : 3.5),
      c: colors[(Math.random() * colors.length) | 0],
      sq: Math.random() > 0.4,
    }));

    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const elapsed = now - t0;
      const fade =
        elapsed < dur * 0.7 ? 1 : Math.max(0, 1 - (elapsed - dur * 0.7) / (dur * 0.3));
      ctx.clearRect(0, 0, w, h);
      for (const p of parts) {
        p.vy += p.g;
        p.x += p.vx;
        p.y += p.vy;
        p.a += p.va;
        ctx.globalAlpha = fade;
        ctx.fillStyle = p.c;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.a);
        if (p.sq) ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s);
        else ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
        ctx.restore();
      }
      if (elapsed < dur) raf = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, w, h);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [kind, duration, density]);

  return (
    <canvas
      ref={ref}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 10,
      }}
    />
  );
}