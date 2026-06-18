import { useMemo, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceDot,
} from "recharts";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { TrendingUp, TrendingDown } from "lucide-react";
import type { RatingHistoryRow } from "@/lib/rating-utils";
import { formatLevel, formatDelta, getDeltaColor } from "@/lib/rating-utils";
import { cn } from "@/lib/utils";

type Range = 5 | 10 | 0; // 0 = todos

interface Props {
  history: RatingHistoryRow[];
  /** Llamado cuando se pulsa "Ver detalle de cambios". */
  onSeeDetails?: () => void;
}

const RANGE_OPTIONS: { value: Range; label: string }[] = [
  { value: 5, label: "5" },
  { value: 10, label: "10" },
  { value: 0, label: "Todos" },
];

export const EvolutionHeroChart = ({ history, onSeeDetails }: Props) => {
  const [range, setRange] = useState<Range>(10);

  const data = useMemo(() => {
    const sorted = [...history].sort(
      (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime(),
    );
    const sliced = range === 0 ? sorted : sorted.slice(-range);
    return sliced.map((h, idx) => ({
      idx,
      level: Number(h.level_after),
      date: h.recorded_at,
      delta: Number(h.delta),
    }));
  }, [history, range]);

  const last = data[data.length - 1];
  const first = data[0];
  const trend = last && first ? last.level - first.level : 0;

  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-card">
      <div className="flex items-end justify-between gap-3 p-4 pb-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Evolución de nivel
          </p>
          <p className="mt-1 font-display text-2xl font-bold leading-none">
            {last ? formatLevel(last.level) : "—"}
          </p>
          {last && first && (
            <p
              className={cn(
                "mt-1 inline-flex items-center gap-0.5 text-[11px] font-semibold",
                getDeltaColor(trend),
              )}
            >
              {trend >= 0 ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {formatDelta(trend)} en este periodo
            </p>
          )}
        </div>

        {/* Toggle 5 / 10 / Todos */}
        <div className="flex gap-1 rounded-full border border-border bg-muted/40 p-0.5">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setRange(opt.value)}
              className={cn(
                "rounded-full px-2.5 py-1 text-[10px] font-semibold transition-smooth",
                range === opt.value
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="h-[180px] w-full px-2">
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            Aún sin historial
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 12, left: -8, bottom: 4 }}>
              <defs>
                <linearGradient id="evoArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" opacity={0.3} />
              <XAxis dataKey="idx" tick={false} axisLine={false} tickLine={false} />
              <YAxis
                domain={["dataMin - 0.2", "dataMax + 0.2"]}
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
                width={32}
              />
              <Tooltip
                contentStyle={{
                  fontSize: 11,
                  borderRadius: 8,
                  border: "1px solid hsl(var(--border))",
                  background: "hsl(var(--background))",
                }}
                formatter={(value: number) => [value.toFixed(2), "Nivel"]}
                labelFormatter={(_, payload) => {
                  const d = payload?.[0]?.payload?.date;
                  return d ? format(new Date(d), "d MMM yyyy", { locale: es }) : "";
                }}
              />
              <Area
                type="monotone"
                dataKey="level"
                stroke="hsl(var(--primary))"
                strokeWidth={2.5}
                fill="url(#evoArea)"
                dot={{ r: 2.5, fill: "hsl(var(--primary))" }}
                activeDot={{ r: 5 }}
              />
              {last && (
                <ReferenceDot
                  x={last.idx}
                  y={last.level}
                  r={5}
                  fill="hsl(var(--success))"
                  stroke="hsl(var(--background))"
                  strokeWidth={2}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {onSeeDetails && data.length > 0 && (
        <button
          type="button"
          onClick={onSeeDetails}
          className="block w-full border-t border-border px-4 py-2.5 text-center text-xs font-semibold text-primary transition-smooth hover:bg-muted/40"
        >
          Ver detalle de cambios →
        </button>
      )}
    </div>
  );
};
