interface Props {
  place: 1 | 2 | 3;
  size?: number;
}

/**
 * Medalla SVG inline con gradient gold/silver/bronze.
 * Sin emojis — accesible y consistente cross-platform.
 */
export function Medal({ place, size = 56 }: Props) {
  const id = `medal-${place}`;
  const colors = {
    1: ["#f5d76e", "#c0a042"],
    2: ["#e6e8ec", "#a8adb6"],
    3: ["#d8a06a", "#a0633a"],
  }[place];

  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={colors[0]} />
          <stop offset="1" stopColor={colors[1]} />
        </linearGradient>
      </defs>
      <circle cx="32" cy="36" r="22" fill={`url(#${id})`} stroke="rgba(0,0,0,0.18)" strokeWidth="1.5" />
      <path d="M18 4 L26 4 L34 28 L26 28 Z" fill="rgba(255,255,255,0.85)" opacity="0.85" />
      <path d="M46 4 L38 4 L30 28 L38 28 Z" fill="rgba(255,255,255,0.85)" opacity="0.85" />
      <text
        x="32"
        y="42"
        textAnchor="middle"
        fontFamily="'Cormorant Garamond', serif"
        fontWeight="700"
        fontSize="22"
        fill="#2b1b12"
      >
        {place}
      </text>
    </svg>
  );
}