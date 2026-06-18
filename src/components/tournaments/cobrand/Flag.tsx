import { cn } from "@/lib/utils";

/**
 * Banderas SVG inline (3 rects verticales para tricolores).
 * No usa emoji — render predecible en todas las plataformas.
 */

type StripeFlag = {
  type: "vertical-tricolor" | "horizontal-tricolor";
  colors: [string, string, string];
};

const FLAGS: Record<string, StripeFlag> = {
  fr: { type: "vertical-tricolor", colors: ["#0055A4", "#FFFFFF", "#EF4135"] },
  cl: { type: "horizontal-tricolor", colors: ["#FFFFFF", "#FFFFFF", "#D52B1E"] },
  ar: { type: "horizontal-tricolor", colors: ["#75AADB", "#FFFFFF", "#75AADB"] },
  es: { type: "horizontal-tricolor", colors: ["#AA151B", "#F1BF00", "#AA151B"] },
  it: { type: "vertical-tricolor", colors: ["#009246", "#FFFFFF", "#CE2B37"] },
};

interface Props {
  countryCode: string | null | undefined;
  className?: string;
  size?: number;
}

export function Flag({ countryCode, className, size = 14 }: Props) {
  const code = (countryCode ?? "").trim().toLowerCase();
  const flag = FLAGS[code];
  const w = size;
  const h = Math.round((size * 11) / 16);

  if (!flag) {
    // Fallback neutro: globo
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 16 11"
        width={w}
        height={h}
        className={cn("inline-block rounded-[1px] ring-1 ring-black/10", className)}
        aria-hidden="true"
      >
        <rect width="16" height="11" fill="#888" />
      </svg>
    );
  }

  if (flag.type === "vertical-tricolor") {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 15 11"
        width={w}
        height={h}
        className={cn("inline-block rounded-[1px] ring-1 ring-black/10", className)}
        aria-label={`Bandera ${code}`}
      >
        <rect x="0" width="5" height="11" fill={flag.colors[0]} />
        <rect x="5" width="5" height="11" fill={flag.colors[1]} />
        <rect x="10" width="5" height="11" fill={flag.colors[2]} />
      </svg>
    );
  }

  // horizontal tricolor (3 franjas iguales)
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 12"
      width={w}
      height={h}
      className={cn("inline-block rounded-[1px] ring-1 ring-black/10", className)}
      aria-label={`Bandera ${code}`}
    >
      <rect y="0" width="16" height="4" fill={flag.colors[0]} />
      <rect y="4" width="16" height="4" fill={flag.colors[1]} />
      <rect y="8" width="16" height="4" fill={flag.colors[2]} />
    </svg>
  );
}