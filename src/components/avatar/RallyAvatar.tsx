import { useId } from "react";
import { cn } from "@/lib/utils";

// ----------------------------------------------------------------------------
// "Rally" — la mascota de AcePlay. Ilustración PRO (Épica I) que reemplaza al
// placeholder anterior SIN cambiar la interfaz pública: `look` + `className`, y
// los exports RALLY_LOOKS / RALLY_LOOK_LABEL / RallyLook que consumen
// UserAvatar y el AvatarPicker. SVG puro (sin assets externos: trademark gate),
// escala nítido a cualquier tamaño; los `defs` llevan ids únicos por instancia
// para que convivan muchos avatares en una lista sin colisionar.
// ----------------------------------------------------------------------------

export const RALLY_LOOKS = [
  "classic", "headband", "cap", "visor", "shades",
  "warpaint", "crown", "pro", "fire", "night",
] as const;
export type RallyLook = (typeof RALLY_LOOKS)[number];

export const RALLY_LOOK_LABEL: Record<RallyLook, string> = {
  classic: "Clásico", headband: "Cinta", cap: "Gorra", visor: "Visera", shades: "Lentes",
  warpaint: "Guerra", crown: "Corona", pro: "Pro", fire: "Fuego", night: "Noche",
};

interface Props { look?: string; className?: string }

export const RallyAvatar = ({ look = "classic", className }: Props) => {
  const safe = (RALLY_LOOKS.includes(look as RallyLook) ? look : "classic") as RallyLook;
  const raw = useId();
  const uid = raw.replace(/[^a-zA-Z0-9_-]/g, "");
  const id = (k: string) => `${uid}-${k}`;

  const night = safe === "night";
  const shades = safe === "shades";
  const fire = safe === "fire";

  return (
    <svg viewBox="0 0 100 100" className={cn("h-full w-full", className)} role="img"
      aria-label={`Rally · ${RALLY_LOOK_LABEL[safe]}`}>
      <defs>
        {/* Cuerpo: pelota de tenis con volumen (o cielo nocturno para 'night'). */}
        <radialGradient id={id("ball")} cx="38%" cy="32%" r="78%">
          {night ? (
            <>
              <stop offset="0%" stopColor="#2a4a6b" />
              <stop offset="55%" stopColor="#16314c" />
              <stop offset="100%" stopColor="#0c1d30" />
            </>
          ) : (
            <>
              <stop offset="0%" stopColor="#e4fb7a" />
              <stop offset="48%" stopColor="#c2e84b" />
              <stop offset="100%" stopColor="#8fb52e" />
            </>
          )}
        </radialGradient>
        <linearGradient id={id("flame")} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#f97316" />
          <stop offset="55%" stopColor="#fb923c" />
          <stop offset="100%" stopColor="#fde047" />
        </linearGradient>
        <linearGradient id={id("gold")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffe27a" />
          <stop offset="100%" stopColor="#e0a90f" />
        </linearGradient>
        <clipPath id={id("clip")}><circle cx="50" cy="52" r="42" /></clipPath>
      </defs>

      {/* Llamas detrás de la cabeza (fire). */}
      {fire && (
        <g fill={`url(#${id("flame")})`}>
          <path d="M30 30c-6 -12 3 -19 5 -27 4 9 12 11 8 24z" />
          <path d="M50 22c-5 -15 6 -22 11 -31 2 13 13 14 6 30z" />
          <path d="M70 30c-4 -9 4 -15 7 -21 2 9 9 11 3 22z" />
        </g>
      )}

      {/* Cuerpo + sombra de contacto + seam de la pelota. */}
      <ellipse cx="50" cy="92" rx="30" ry="4.5" fill="#000" opacity="0.10" />
      <circle cx="50" cy="52" r="42" fill={`url(#${id("ball")})`} />
      <circle cx="50" cy="52" r="42" fill="none" stroke={night ? "#0a1726" : "#7da528"} strokeOpacity="0.5" strokeWidth="1.5" />
      <g clipPath={`url(#${id("clip")})`}>
        <path d="M6 34c18 12 70 12 88 0" fill="none" stroke={night ? "#1f3a57" : "#ffffff"} strokeWidth="4" strokeLinecap="round" opacity="0.9" />
        <path d="M6 70c18 -12 70 -12 88 0" fill="none" stroke={night ? "#1f3a57" : "#ffffff"} strokeWidth="4" strokeLinecap="round" opacity="0.9" />
        {/* brillo superior */}
        <ellipse cx="36" cy="30" rx="20" ry="12" fill="#ffffff" opacity={night ? 0.06 : 0.22} />
      </g>

      {/* Mejillas (no en night/shades para mantener el gesto). */}
      {!night && !shades && (
        <g fill="#f6886a" opacity="0.35">
          <ellipse cx="29" cy="62" rx="5.5" ry="3.5" />
          <ellipse cx="71" cy="62" rx="5.5" ry="3.5" />
        </g>
      )}

      {/* Cara. 'night' = ojos dormidos; el resto, ojos vivos con brillo. */}
      {night ? (
        <g fill="none" stroke="#cdd9e6" strokeWidth="2.6" strokeLinecap="round">
          <path d="M30 50q7 5 14 0" />
          <path d="M56 50q7 5 14 0" />
        </g>
      ) : (
        <g>
          {/* cejas, sutiles, dan personalidad */}
          <g stroke="#1c2c46" strokeWidth="2.4" strokeLinecap="round" fill="none" opacity="0.9">
            <path d={fire ? "M28 40l16 -2" : "M30 41q8 -3 15 -1"} />
            <path d={fire ? "M72 40l-16 -2" : "M70 41q-8 -3 -15 -1"} />
          </g>
          <circle cx="37" cy="51" r="8" fill="#ffffff" />
          <circle cx="63" cy="51" r="8" fill="#ffffff" />
          <circle cx="38" cy="52" r="3.6" fill="#15233b" />
          <circle cx="62" cy="52" r="3.6" fill="#15233b" />
          <circle cx="39.4" cy="50.4" r="1.3" fill="#ffffff" />
          <circle cx="63.4" cy="50.4" r="1.3" fill="#ffffff" />
        </g>
      )}

      {/* Boca: sonrisa amistosa (un poco más intensa en fire). */}
      <path d={fire ? "M39 67q11 11 22 0" : "M40 67q10 8 20 0"} fill="none"
        stroke={night ? "#cdd9e6" : "#15233b"} strokeWidth="3" strokeLinecap="round" />

      {/* ---------------- Accesorios por look ---------------- */}
      {safe === "headband" && (
        <g>
          <path d="M13 38q37 -16 74 0v9q-37 -12 -74 0z" fill="#e3433a" />
          <rect x="40" y="34" width="20" height="4.5" rx="2" fill="#ffffff" opacity="0.85" />
          <path d="M84 41l9 -4 -2 7 7 1 -8 5z" fill="#e3433a" />
        </g>
      )}

      {safe === "cap" && (
        <g>
          <path d="M16 39a34 27 0 0 1 68 0q-34 -9 -68 0z" fill="#2563eb" />
          <path d="M16 39a34 27 0 0 1 68 0" fill="none" stroke="#1e3a8a" strokeWidth="1.5" />
          <path d="M50 41h44a10 7 0 0 1 -12 9q-16 -6 -32 -2z" fill="#1d4ed8" />
          <circle cx="50" cy="12.5" r="3.2" fill="#1e3a8a" />
        </g>
      )}

      {safe === "visor" && (
        <g>
          <path d="M20 36h60a6 5 0 0 1 0 10H20a6 5 0 0 1 0 -10z" fill="#f59e0b" />
          <path d="M50 40h46a12 8 0 0 1 -14 9q-16 -6 -32 -2z" fill="#d97706" />
        </g>
      )}

      {shades && (
        <g>
          <path d="M22 48h56" stroke="#0b1626" strokeWidth="3" strokeLinecap="round" />
          <g fill="#0b1626" stroke="#0b1626">
            <rect x="20" y="44" width="24" height="15" rx="6" />
            <rect x="56" y="44" width="24" height="15" rx="6" />
          </g>
          <path d="M24 47l8 3M60 47l8 3" stroke="#5fd0ff" strokeWidth="2.4" strokeLinecap="round" opacity="0.85" />
        </g>
      )}

      {safe === "warpaint" && (
        <g stroke="#e3433a" strokeWidth="3.4" strokeLinecap="round">
          <line x1="28" y1="60" x2="40" y2="67" />
          <line x1="31" y1="57" x2="42" y2="63" />
          <line x1="72" y1="60" x2="60" y2="67" />
          <line x1="69" y1="57" x2="58" y2="63" />
        </g>
      )}

      {safe === "crown" && (
        <g>
          <path d="M26 32l3 -16 9 11 12 -16 12 16 9 -11 3 16z" fill={`url(#${id("gold")})`} stroke="#b8930f" strokeWidth="1.4" strokeLinejoin="round" />
          <rect x="26" y="31" width="48" height="5" rx="2" fill={`url(#${id("gold")})`} stroke="#b8930f" strokeWidth="1" />
          <circle cx="50" cy="26" r="2.4" fill="#e3433a" />
          <circle cx="34" cy="30" r="1.8" fill="#5fd0ff" />
          <circle cx="66" cy="30" r="1.8" fill="#5fd0ff" />
        </g>
      )}

      {safe === "pro" && (
        <g>
          <path d="M13 37q37 -15 74 0v8q-37 -11 -74 0z" fill="#ffffff" />
          <path d="M13 37q37 -15 74 0" fill="none" stroke="#e3433a" strokeWidth="3" />
          <path d="M50 31l2.4 4.9 5.4 .8 -3.9 3.8 .9 5.4 -4.8 -2.6 -4.8 2.6 .9 -5.4 -3.9 -3.8 5.4 -.8z" fill="#e3433a" />
        </g>
      )}

      {fire && (
        <g fill={`url(#${id("flame")})`} opacity="0.95">
          <path d="M40 24c-4 -8 2 -12 4 -17 2 7 8 7 5 16z" />
          <path d="M56 22c-3 -10 4 -14 7 -20 1 9 9 10 4 21z" />
        </g>
      )}

      {night && (
        <g>
          <path d="M74 16a8 8 0 1 0 5 13 10 10 0 0 1 -5 -13z" fill="#ffe9a8" />
          <g fill="#ffe9a8">
            <path d="M24 18l1 3 3 1 -3 1 -1 3 -1 -3 -3 -1 3 -1z" />
            <circle cx="40" cy="12" r="1.2" />
            <circle cx="58" cy="13" r="1" />
          </g>
        </g>
      )}
    </svg>
  );
};

export default RallyAvatar;
