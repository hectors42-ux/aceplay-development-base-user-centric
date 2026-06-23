import { cn } from "@/lib/utils";

// Los 10 looks de la mascota "Rally". Interfaz estable: la ilustración "pro"
// llega en la Épica I y se intercambia sin tocar a los consumidores.
export const RALLY_LOOKS = [
  "classic", "headband", "cap", "visor", "shades",
  "warpaint", "crown", "pro", "fire", "night",
] as const;
export type RallyLook = (typeof RALLY_LOOKS)[number];

export const RALLY_LOOK_LABEL: Record<RallyLook, string> = {
  classic: "Clásico", headband: "Cinta", cap: "Gorra", visor: "Visera", shades: "Lentes",
  warpaint: "Guerra", crown: "Corona", pro: "Pro", fire: "Fuego", night: "Noche",
};

const BALL = "#c2e84b";        // verde pelota
const BALL_DARK = "#0f1f33";   // pelota "night"
const SEAM = "#ffffff";
const FACE = "#13233b";

// Accesorio por look (se dibuja sobre la cara).
function Accessory({ look }: { look: RallyLook }) {
  switch (look) {
    case "headband":
      return <rect x="14" y="30" width="72" height="11" rx="3" fill="#e3433a" />;
    case "cap":
      return (
        <g>
          <path d="M18 34a32 24 0 0 1 64 0z" fill="#2563eb" />
          <path d="M50 34h40a8 6 0 0 1 -8 8H50z" fill="#1e3a8a" />
          <circle cx="50" cy="14" r="3" fill="#1e3a8a" />
        </g>
      );
    case "visor":
      return (
        <g>
          <path d="M22 32h56a6 5 0 0 1 0 10H22a6 5 0 0 1 0 -10z" fill="#f59e0b" />
          <path d="M50 37h42a10 7 0 0 1 -10 8H50z" fill="#d97706" />
        </g>
      );
    case "shades":
      return (
        <g fill="#0b1626">
          <rect x="22" y="40" width="22" height="14" rx="5" />
          <rect x="56" y="40" width="22" height="14" rx="5" />
          <rect x="44" y="45" width="12" height="3" />
        </g>
      );
    case "warpaint":
      return (
        <g stroke="#e3433a" strokeWidth="3" strokeLinecap="round">
          <line x1="30" y1="60" x2="40" y2="66" />
          <line x1="70" y1="60" x2="60" y2="66" />
        </g>
      );
    case "crown":
      return (
        <path d="M28 30l6 -14 8 10 8 -14 8 14 8 -10 6 14z" fill="#f5c518" stroke="#b8930f" strokeWidth="1.5" strokeLinejoin="round" />
      );
    case "pro":
      return (
        <g>
          <rect x="14" y="32" width="72" height="8" rx="4" fill="#ffffff" />
          <rect x="14" y="32" width="72" height="3" rx="2" fill="#e3433a" />
        </g>
      );
    case "fire":
      return (
        <g fill="#fb7185">
          <path d="M40 26c-4 -8 2 -12 4 -16 2 6 8 6 6 14z" />
          <path d="M52 24c-3 -10 4 -14 8 -20 1 9 9 9 4 20z" fill="#f59e0b" />
          <path d="M62 28c-2 -6 3 -9 6 -13 1 6 6 7 2 14z" />
        </g>
      );
    case "night":
      return (
        <g>
          <path d="M70 16a9 9 0 1 0 6 14 11 11 0 0 1 -6 -14z" fill="#fde68a" />
          <circle cx="26" cy="20" r="1.6" fill="#fde68a" />
          <circle cx="40" cy="13" r="1.2" fill="#fde68a" />
          <circle cx="56" cy="14" r="1.4" fill="#fde68a" />
        </g>
      );
    default:
      return null;
  }
}

interface Props { look?: string; className?: string }

/**
 * Avatar de la mascota Rally (SVG placeholder). Tamaño por className (h-/w-).
 */
export const RallyAvatar = ({ look = "classic", className }: Props) => {
  const safe = (RALLY_LOOKS.includes(look as RallyLook) ? look : "classic") as RallyLook;
  const night = safe === "night";
  const ball = night ? BALL_DARK : BALL;
  const eye = night ? "#cbd5e1" : "#ffffff";
  return (
    <svg viewBox="0 0 100 100" className={cn("h-full w-full", className)} role="img" aria-label={`Rally · ${RALLY_LOOK_LABEL[safe]}`}>
      <circle cx="50" cy="52" r="42" fill={ball} />
      {/* costuras estilo pelota */}
      <path d="M14 38c16 8 56 8 72 0" fill="none" stroke={SEAM} strokeWidth="3" opacity="0.85" />
      <path d="M14 66c16 -8 56 -8 72 0" fill="none" stroke={SEAM} strokeWidth="3" opacity="0.85" />
      {/* ojos */}
      <circle cx="38" cy="52" r="7" fill={eye} />
      <circle cx="62" cy="52" r="7" fill={eye} />
      <circle cx={night ? 38 : 39} cy="53" r="3.2" fill={FACE} />
      <circle cx={night ? 62 : 63} cy="53" r="3.2" fill={FACE} />
      {/* sonrisa */}
      <path d="M40 68q10 8 20 0" fill="none" stroke={FACE} strokeWidth="3" strokeLinecap="round" />
      <Accessory look={safe} />
    </svg>
  );
};

export default RallyAvatar;
