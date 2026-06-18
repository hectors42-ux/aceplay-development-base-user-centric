import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";

interface Props {
  totalMatches: number;
  totalWins: number;
  recentMatches: number;
  recentWins: number;
  recentLabel?: string;
}

const Cell2 = ({ value, label }: { value: string | number; label: string }) => (
  <div className="flex flex-col items-center justify-center rounded-2xl bg-muted/40 p-2.5">
    <p className="font-display text-xl font-bold leading-none tabular-nums">{value}</p>
    <p className="mt-1 text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
      {label}
    </p>
  </div>
);

export const StatsBlock = ({
  totalMatches,
  totalWins,
  recentMatches,
  recentWins,
  recentLabel = "Últimos",
}: Props) => {
  const totalLosses = Math.max(totalMatches - totalWins, 0);
  const recentLosses = Math.max(recentMatches - recentWins, 0);
  const recentPct =
    recentMatches > 0 ? Math.round((recentWins / recentMatches) * 100) : 0;

  const donutData = [
    { name: "win", value: recentWins || 0.0001 },
    { name: "loss", value: Math.max(recentLosses, 0) },
  ];

  return (
    <div className="rounded-3xl border border-border bg-card p-4 shadow-card">
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Estadísticas
      </p>

      <div className="grid grid-cols-[1fr_1fr_1.2fr] items-center gap-3">
        {/* Columna izquierda: 2x2 con totales y últimos */}
        <div className="grid grid-cols-1 gap-2">
          <Cell2 value={totalMatches} label="Total" />
          <Cell2 value={recentMatches} label={recentLabel} />
        </div>
        <div className="grid grid-cols-1 gap-2">
          <Cell2 value={totalWins} label="Ganados" />
          <Cell2 value={recentWins} label="Ganados" />
        </div>

        {/* Donut grande: efectividad reciente */}
        <div className="relative mx-auto h-28 w-28">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={donutData}
                dataKey="value"
                innerRadius="70%"
                outerRadius="100%"
                startAngle={90}
                endAngle={-270}
                stroke="none"
                isAnimationActive={false}
              >
                <Cell fill="hsl(var(--success))" />
                <Cell fill="hsl(var(--muted))" />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-display text-xl font-bold leading-none">
              {recentPct}%
            </span>
            <span className="mt-0.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
              Efectividad
            </span>
          </div>
        </div>
      </div>

      {/* Resumen V/D global */}
      <div className="mt-3 flex items-center justify-center gap-3 border-t border-border pt-3 text-[11px]">
        <span className="inline-flex items-center gap-1">
          <span className={cn("h-2 w-2 rounded-full bg-success")} />
          <span className="font-semibold">{totalWins}</span>
          <span className="text-muted-foreground">ganados</span>
        </span>
        <span className="text-muted-foreground">·</span>
        <span className="inline-flex items-center gap-1">
          <span className={cn("h-2 w-2 rounded-full bg-destructive")} />
          <span className="font-semibold">{totalLosses}</span>
          <span className="text-muted-foreground">perdidos</span>
        </span>
      </div>
    </div>
  );
};
