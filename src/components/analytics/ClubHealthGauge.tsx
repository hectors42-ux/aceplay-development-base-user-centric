import { cn } from "@/lib/utils";

interface ClubHealthGaugeProps {
  score: number; // 0-100
  size?: number;
}

export function ClubHealthGauge({ score, size = 160 }: ClubHealthGaugeProps) {
  const safe = Math.max(0, Math.min(100, score));
  const radius = size / 2 - 12;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (safe / 100) * circ;

  const tone = safe >= 75 ? "text-success" : safe >= 50 ? "text-primary" : "text-destructive";
  const label = safe >= 75 ? "Saludable" : safe >= 50 ? "Atención" : "Crítico";

  return (
    <div className="relative flex flex-col items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="hsl(var(--muted))" strokeWidth={10} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={10}
          fill="none"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={cn("transition-all duration-500", tone)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-3xl font-semibold tabular-nums">{Math.round(safe)}</span>
        <span className={cn("text-xs font-medium uppercase tracking-wide", tone)}>{label}</span>
      </div>
    </div>
  );
}
