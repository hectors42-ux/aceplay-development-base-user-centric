import { useLayoutEffect, useRef } from 'react';

interface Props {
  d: string;
  color?: string;
  strokeWidth?: number;
  delay?: number;
  duration?: number;
}

export function AnimatedPath({
  d,
  color = 'hsl(var(--primary))',
  strokeWidth = 2.4,
  delay = 0,
  duration = 700,
}: Props) {
  const ref = useRef<SVGPathElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;
    const total = el.getTotalLength();
    el.style.strokeDasharray = String(total);
    el.style.strokeDashoffset = String(total);
    // force layout flush so the transition runs
    el.getBoundingClientRect();
    el.style.transition = `stroke-dashoffset ${duration}ms cubic-bezier(.2,.7,.1,1) ${delay}ms`;
    el.style.strokeDashoffset = '0';
  }, [d, delay, duration]);

  return (
    <path
      ref={ref}
      d={d}
      stroke={color}
      strokeWidth={strokeWidth}
      fill="none"
      strokeLinecap="round"
      style={{ filter: 'drop-shadow(0 0 4px hsl(var(--primary) / .55))' }}
    />
  );
}