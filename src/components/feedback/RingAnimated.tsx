import { useEffect, useId, useState } from 'react';

interface Props {
  pct: number;
  size?: number;
  stroke?: number;
  duration?: number;
  track?: string;
}

export function RingAnimated({
  pct,
  size = 140,
  stroke = 12,
  duration = 1100,
  track,
}: Props) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.max(0, Math.min(100, pct)) / 100);
  const reduced =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [dash, setDash] = useState(reduced ? off : c);
  const gid = useId();

  useEffect(() => {
    if (reduced) {
      setDash(off);
      return;
    }
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => setDash(off)),
    );
    return () => cancelAnimationFrame(id);
  }, [off, reduced]);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <defs>
        <linearGradient id={gid} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--primary))" />
          <stop offset="100%" stopColor="hsl(var(--primary-deep))" />
        </linearGradient>
      </defs>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={track || 'hsl(var(--muted))'}
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={`url(#${gid})`}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={dash}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{
          transition: `stroke-dashoffset ${duration}ms cubic-bezier(.2,.7,.1,1)`,
        }}
      />
    </svg>
  );
}