import { AnalyticsShell } from "@/components/analytics/AnalyticsShell";
import { HeatmapGrid } from "@/components/analytics/HeatmapGrid";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAnalyticsOccupancy } from "@/hooks/analytics/useAnalyticsOccupancy";

export default function AnalyticsOperation() {
  const { data, isLoading } = useAnalyticsOccupancy();
  return (
    <AnalyticsShell title="Operación del club" subtitle="Mapa de calor de ocupación día × hora.">
      <Card className="rounded-2xl border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="font-display text-base">Mapa de calor de reservas</CardTitle>
        </CardHeader>
        <CardContent>
          <HeatmapGrid data={data} loading={isLoading} />
        </CardContent>
      </Card>
    </AnalyticsShell>
  );
}
