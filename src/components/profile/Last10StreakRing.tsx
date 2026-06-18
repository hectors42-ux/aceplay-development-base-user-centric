import { cn } from "@/lib/utils";

interface Props {
  /** Resultados ordenados del más antiguo al más reciente, max 10. true = ganado. */
  results: boolean[];
  size?: number;
  stroke?: number;
}

/**
 * Anillo de 10 segmentos coloreados según resultado.
 * Verde = ganado, rojo = perdido, gris = sin dato.
 */
export const Last10StreakRing = ({ results, size = 72, stroke = 7 }: Props) => {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const slots = 10;
  const gap = 2; // px entre segmentos
  const segLen = c / slots - gap;

  const wins = results.filter(Boolean).length;
  const losses = results.length - wins;
  const ariaLabel =
    results.length === 0
      ? "Sin partidos en los últimos 10"
      : `Últimos ${results.length} partidos: ${wins} ${
          wins === 1 ? "victoria" : "victorias"
        } y ${losses} ${losses === 1 ? "derrota" : "derrotas"}`;

  return (
    <div
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={ariaLabel}
    >
      <svg
        width={size}
        height={size}
        className="-rotate-90"
        aria-hidden="true"
        focusable="false"
      >
        {Array.from({ length: slots }).map((_, i) => {
          const result = results[i];
          const offset = -(i * (segLen + gap));
          let className = "stroke-muted";
          if (result === true) className = "stroke-success";
          else if (result === false) className = "stroke-destructive";
          return (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              strokeWidth={stroke}
              strokeLinecap="butt"
              strokeDasharray={`${segLen} ${c - segLen}`}
              strokeDashoffset={offset}
              className={cn(className, "transition-all duration-500")}
            />
          );
        })}
      </svg>
      <div aria-hidden="true" className="absolute flex flex-col items-center leading-none">
        <span className="font-display text-sm font-bold tabular-nums">
          {wins}
          <span className="text-muted-foreground">/</span>
          {losses}
        </span>
        <span className="mt-0.5 text-[8px] font-medium uppercase tracking-wider text-muted-foreground">
          V·D
        </span>
      </div>
    </div>
  );
};
