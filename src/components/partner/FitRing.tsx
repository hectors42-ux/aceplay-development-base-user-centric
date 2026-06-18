import { cn } from "@/lib/utils";

interface FitRingProps {
  score: number | null;
  size?: number;
  className?: string;
}

/**
 * Anillo SVG fino con el % de compatibilidad. Si score es null muestra "Calib.".
 */
export const FitRing = ({ score, size = 56, className }: FitRingProps) => {
  const stroke = 3;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = score == null ? 0 : Math.max(0, Math.min(100, score));
  const dash = (pct / 100) * c;
  const color =
    score == null
      ? "stroke-muted-foreground/40"
      : pct >= 75
      ? "stroke-success"
      : pct >= 50
      ? "stroke-primary"
      : "stroke-warning";

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className="stroke-border"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
          className={cn("transition-all", color)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center leading-none">
        {score == null ? (
          <span className="text-[9px] font-medium text-muted-foreground">Calib.</span>
        ) : (
          <>
            <span className="font-display text-base font-semibold">{Math.round(pct)}</span>
            <span className="text-[8px] uppercase tracking-wide text-muted-foreground">fit</span>
          </>
        )}
      </div>
    </div>
  );
};
