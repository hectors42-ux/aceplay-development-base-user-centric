import { memo } from "react";

interface Props {
  rank: 1 | 2 | 3;
  size?: number;
}

const STOPS: Record<1 | 2 | 3, [string, string]> = {
  1: ["#f6d97b", "#c0a042"],
  2: ["#e6e7ea", "#9da3ad"],
  3: ["#e8b58a", "#a86b3b"],
};

export const MedalBadge = memo(function MedalBadge({ rank, size = 22 }: Props) {
  const [a, b] = STOPS[rank];
  const id = `medal-${rank}`;
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" aria-label={`Medalla ${rank}`}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={a} />
          <stop offset="100%" stopColor={b} />
        </linearGradient>
      </defs>
      <circle cx="11" cy="11" r="10" fill={`url(#${id})`} stroke="rgba(255,255,255,.5)" strokeWidth="1" />
      <text
        x="11"
        y="14.5"
        textAnchor="middle"
        fontSize="11"
        fontWeight="700"
        fill="rgba(0,0,0,.7)"
        fontFamily="ui-sans-serif, system-ui"
      >
        {rank}
      </text>
    </svg>
  );
});