import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { RatingHistoryRow } from "@/lib/rating-utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Props {
  history: RatingHistoryRow[];
}

export const RatingEvolutionChart = ({ history }: Props) => {
  const data = useMemo(() => {
    // Más antiguos primero para el eje X
    return [...history]
      .reverse()
      .map((h, idx) => ({
        idx,
        level: Number(h.level_after),
        date: h.recorded_at,
      }));
  }, [history]);

  if (data.length === 0) {
    return (
      <div className="flex h-[180px] items-center justify-center rounded-2xl border border-dashed border-border bg-card text-xs text-muted-foreground">
        Aún no hay historial de cambios
      </div>
    );
  }

  return (
    <div className="h-[180px] w-full rounded-2xl border border-border bg-card p-3">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" opacity={0.4} />
          <XAxis
            dataKey="idx"
            tick={false}
            axisLine={false}
            tickLine={false}
          />
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
              return d ? format(new Date(d), "d MMM", { locale: es }) : "";
            }}
          />
          <Line
            type="monotone"
            dataKey="level"
            stroke="hsl(var(--primary))"
            strokeWidth={2.5}
            dot={{ r: 3, fill: "hsl(var(--primary))" }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
