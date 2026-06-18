import type { FC } from "react";
import type { PresetKey } from "@/lib/tournament-presets";

type Props = { className?: string };

const svgBase = "w-full h-full";
const stroke = {
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export const PicBracket: FC<Props> = ({ className }) => (
  <svg viewBox="0 0 60 44" className={className ?? svgBase} {...stroke}>
    <line x1="4" y1="8" x2="14" y2="8" />
    <line x1="4" y1="18" x2="14" y2="18" />
    <line x1="4" y1="28" x2="14" y2="28" />
    <line x1="4" y1="38" x2="14" y2="38" />
    <path d="M14 8 L22 13 L14 18" />
    <path d="M14 28 L22 33 L14 38" />
    <line x1="22" y1="13" x2="32" y2="13" />
    <line x1="22" y1="33" x2="32" y2="33" />
    <path d="M32 13 L42 23 L32 33" />
    <line x1="42" y1="23" x2="54" y2="23" />
    <circle cx="56" cy="23" r="2" />
  </svg>
);

export const PicConsolacion: FC<Props> = ({ className }) => (
  <svg viewBox="0 0 60 44" className={className ?? svgBase} {...stroke}>
    <line x1="4" y1="8" x2="12" y2="8" />
    <line x1="4" y1="16" x2="12" y2="16" />
    <path d="M12 8 L20 12 L12 16" />
    <line x1="20" y1="12" x2="30" y2="12" />
    <circle cx="33" cy="12" r="2" />
    <line x1="4" y1="30" x2="12" y2="30" />
    <line x1="4" y1="38" x2="12" y2="38" />
    <path d="M12 30 L20 34 L12 38" strokeDasharray="2 2" />
    <line x1="20" y1="34" x2="30" y2="34" strokeDasharray="2 2" />
    <circle cx="33" cy="34" r="2" />
    <text x="40" y="15" fontSize="6" fill="currentColor" stroke="none">A</text>
    <text x="40" y="37" fontSize="6" fill="currentColor" stroke="none">B</text>
  </svg>
);

export const PicDoubleElim: FC<Props> = ({ className }) => (
  <svg viewBox="0 0 60 44" className={className ?? svgBase} {...stroke}>
    <rect x="4" y="6" width="10" height="6" rx="1" />
    <rect x="4" y="16" width="10" height="6" rx="1" />
    <path d="M14 9 L22 13 L14 16" />
    <line x1="22" y1="13" x2="32" y2="13" />
    <path d="M32 13 L40 19" />
    <rect x="4" y="28" width="10" height="6" rx="1" strokeDasharray="2 2" />
    <rect x="4" y="36" width="10" height="4" rx="1" strokeDasharray="2 2" />
    <path d="M14 31 L22 33 L14 36" strokeDasharray="2 2" />
    <line x1="22" y1="33" x2="32" y2="33" strokeDasharray="2 2" />
    <path d="M32 33 L40 25" strokeDasharray="2 2" />
    <circle cx="44" cy="22" r="3" />
  </svg>
);

export const PicRoundRobin: FC<Props> = ({ className }) => (
  <svg viewBox="0 0 60 44" className={className ?? svgBase} {...stroke}>
    <circle cx="30" cy="22" r="16" />
    <circle cx="30" cy="6" r="2.5" fill="currentColor" />
    <circle cx="46" cy="22" r="2.5" fill="currentColor" />
    <circle cx="30" cy="38" r="2.5" fill="currentColor" />
    <circle cx="14" cy="22" r="2.5" fill="currentColor" />
    <line x1="30" y1="6" x2="46" y2="22" />
    <line x1="46" y1="22" x2="30" y2="38" />
    <line x1="30" y1="38" x2="14" y2="22" />
    <line x1="14" y1="22" x2="30" y2="6" />
    <line x1="30" y1="6" x2="30" y2="38" />
    <line x1="14" y1="22" x2="46" y2="22" />
  </svg>
);

export const PicGroupsBracket: FC<Props> = ({ className }) => (
  <svg viewBox="0 0 60 44" className={className ?? svgBase} {...stroke}>
    <rect x="3" y="5" width="14" height="14" rx="2" />
    <line x1="6" y1="9" x2="14" y2="9" />
    <line x1="6" y1="13" x2="14" y2="13" />
    <line x1="6" y1="17" x2="14" y2="17" />
    <rect x="3" y="25" width="14" height="14" rx="2" />
    <line x1="6" y1="29" x2="14" y2="29" />
    <line x1="6" y1="33" x2="14" y2="33" />
    <line x1="6" y1="37" x2="14" y2="37" />
    <path d="M17 12 L26 16" />
    <path d="M17 32 L26 28" />
    <line x1="26" y1="16" x2="36" y2="16" />
    <line x1="26" y1="28" x2="36" y2="28" />
    <path d="M36 16 L44 22 L36 28" />
    <line x1="44" y1="22" x2="52" y2="22" />
    <path d="M53 18 L57 18 L57 24 L53 24 Z" />
    <line x1="55" y1="24" x2="55" y2="28" />
    <line x1="52" y1="28" x2="58" y2="28" />
  </svg>
);

const stickFigure = (cx: number, cy: number) => (
  <g key={`fig-${cx}-${cy}`}>
    <circle cx={cx} cy={cy - 5} r="2.5" />
    <line x1={cx} y1={cy - 2.5} x2={cx} y2={cy + 4} />
    <line x1={cx - 3} y1={cy} x2={cx + 3} y2={cy} />
    <line x1={cx} y1={cy + 4} x2={cx - 3} y2={cy + 9} />
    <line x1={cx} y1={cy + 4} x2={cx + 3} y2={cy + 9} />
  </g>
);

export const PicAmericanoParejas: FC<Props> = ({ className }) => (
  <svg viewBox="0 0 60 44" className={className ?? svgBase} {...stroke}>
    {stickFigure(14, 16)}
    {stickFigure(24, 16)}
    <path d="M14 27 Q19 32 24 27" />
    {stickFigure(36, 16)}
    {stickFigure(46, 16)}
    <path d="M36 27 Q41 32 46 27" />
  </svg>
);

export const PicAmericanoRotacion: FC<Props> = ({ className }) => (
  <svg viewBox="0 0 60 44" className={className ?? svgBase} {...stroke}>
    {stickFigure(14, 12)}
    {stickFigure(46, 12)}
    {stickFigure(14, 34)}
    {stickFigure(46, 34)}
    <path d="M22 10 Q30 6 38 10" />
    <polyline points="36,7 38,10 35,11" />
    <path d="M38 36 Q30 40 22 36" />
    <polyline points="24,39 22,36 25,35" />
    <path d="M10 18 Q6 23 10 28" />
    <polyline points="9,25 10,28 13,27" />
    <path d="M50 28 Q54 23 50 18" />
    <polyline points="51,21 50,18 47,19" />
  </svg>
);

export const PicPiramide: FC<Props> = ({ className }) => (
  <svg viewBox="0 0 60 44" className={className ?? svgBase} {...stroke}>
    <rect x="26" y="6" width="8" height="6" rx="1" />
    <rect x="20" y="15" width="8" height="6" rx="1" />
    <rect x="32" y="15" width="8" height="6" rx="1" />
    <rect x="14" y="24" width="8" height="6" rx="1" />
    <rect x="26" y="24" width="8" height="6" rx="1" />
    <rect x="38" y="24" width="8" height="6" rx="1" />
    <rect x="8" y="33" width="8" height="6" rx="1" />
    <rect x="20" y="33" width="8" height="6" rx="1" />
    <rect x="32" y="33" width="8" height="6" rx="1" />
    <rect x="44" y="33" width="8" height="6" rx="1" />
  </svg>
);

export const PicCustom: FC<Props> = ({ className }) => (
  <svg viewBox="0 0 60 44" className={className ?? svgBase} {...stroke}>
    <line x1="8" y1="12" x2="52" y2="12" />
    <circle cx="22" cy="12" r="3" fill="currentColor" />
    <line x1="8" y1="22" x2="52" y2="22" />
    <circle cx="38" cy="22" r="3" fill="currentColor" />
    <line x1="8" y1="32" x2="52" y2="32" />
    <circle cx="30" cy="32" r="3" fill="currentColor" />
  </svg>
);

export const FORMAT_ICON_BY_PRESET: Record<PresetKey, FC<Props>> = {
  eliminacion_simple: PicBracket,
  consolacion: PicConsolacion,
  doble_eliminacion: PicDoubleElim,
  round_robin_liga: PicRoundRobin,
  escalerilla: PicPiramide,
  grupos_playoff: PicGroupsBracket,
  americano_parejas: PicAmericanoParejas,
  americano_rotacion: PicAmericanoRotacion,
  escalera: PicPiramide,
  personalizado: PicCustom,
};