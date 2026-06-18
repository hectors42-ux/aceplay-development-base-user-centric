interface Props {
  values: number[];
  width?: number;
  height?: number;
}

export const MiniSparkline = ({ values, width = 220, height = 48 }: Props) => {
  if (!values || values.length < 2) {
    return (
      <div
        className="flex items-center justify-center rounded-xl border border-dashed border-border bg-card/50 text-[10px] text-muted-foreground"
        style={{ width: "100%", height }}
      >
        Aún sin suficiente historial
      </div>
    );
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = width / (values.length - 1);
  const points = values
    .map((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / range) * (height - 6) - 3;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const last = values[values.length - 1];
  const first = values[0];
  const trendingUp = last >= first;
  const stroke = trendingUp ? "hsl(var(--success))" : "hsl(var(--destructive))";

  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="h-12 w-full">
      <polyline fill="none" stroke={stroke} strokeWidth={2} points={points} strokeLinecap="round" strokeLinejoin="round" />
      {/* last dot */}
      <circle
        cx={(values.length - 1) * stepX}
        cy={height - ((last - min) / range) * (height - 6) - 3}
        r={3}
        fill={stroke}
      />
    </svg>
  );
};
