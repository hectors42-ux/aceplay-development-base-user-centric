import { cn } from "@/lib/utils";

interface Props {
  /** Valor 0-100 para el progreso del anillo. */
  percent: number;
  /** Texto grande al centro (ej: "72%" o "24"). */
  centerLabel: string;
  /** Color semántico del anillo. */
  tone?: "primary" | "success" | "muted";
  /** Tamaño en px. */
  size?: number;
  /** Grosor del trazo. */
  stroke?: number;
  /** Label accesible completo (ej: "72% de partidos ganados, 17 victorias y 7 derrotas"). */
  ariaLabel?: string;
}

const TONE: Record<NonNullable<Props["tone"]>, { track: string; bar: string; text: string }> = {
  primary: {
    track: "stroke-primary/15",
    bar: "stroke-primary",
    text: "text-foreground",
  },
  success: {
    track: "stroke-success/15",
    bar: "stroke-success",
    text: "text-foreground",
  },
  muted: {
    track: "stroke-muted",
    bar: "stroke-muted-foreground/60",
    text: "text-foreground",
  },
};

export const StatRing = ({
  percent,
  centerLabel,
  tone = "primary",
  size = 72,
  stroke = 7,
  ariaLabel,
}: Props) => {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const safe = Math.max(0, Math.min(100, percent));
  const dash = (safe / 100) * c;
  const colors = TONE[tone];
  const label = ariaLabel ?? `${centerLabel} (${Math.round(safe)}%)`;

  return (
    <div
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={label}
    >
      <svg
        width={size}
        height={size}
        className="-rotate-90"
        aria-hidden="true"
        focusable="false"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className={colors.track}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
          className={cn(colors.bar, "transition-all duration-500 ease-out")}
        />
      </svg>
      <span
        aria-hidden="true"
        className={cn(
          "absolute font-display text-base font-bold tabular-nums leading-none",
          colors.text,
        )}
      >
        {centerLabel}
      </span>
    </div>
  );
};
