import { BarChart3 } from "lucide-react";

interface EmptyAnalyticsStateProps {
  title?: string;
  description?: string;
}

export function EmptyAnalyticsState({
  title = "Aún no hay datos suficientes",
  description = "A medida que el club genere actividad, esta vista se irá llenando con métricas en vivo.",
}: EmptyAnalyticsStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-muted/20 px-6 py-12 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <BarChart3 className="h-5 w-5" />
      </div>
      <h3 className="font-display text-base font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
