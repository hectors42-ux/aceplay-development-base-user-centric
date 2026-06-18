import { AnalyticsShell } from "@/components/analytics/AnalyticsShell";
import { KpiCard } from "@/components/analytics/KpiCard";
import { RankingTable } from "@/components/analytics/RankingTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAnalyticsMembers } from "@/hooks/analytics/useAnalyticsMembers";

export default function AnalyticsMembers() {
  const { data, isLoading } = useAnalyticsMembers();
  return (
    <AnalyticsShell title="Socios y engagement" subtitle="Actividad, riesgo y conversión competitiva.">
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        <KpiCard label="Total socios" value={data?.total_members ?? null} loading={isLoading} />
        <KpiCard label="Reservas/socio" value={data?.avg_bookings_per_member ?? null} loading={isLoading} />
        <KpiCard label="Categoría C" value={data?.distribution.C ?? null} loading={isLoading} />
        <KpiCard label="Categoría B" value={data?.distribution.B ?? null} loading={isLoading} />
        <KpiCard label="Categoría A" value={data?.distribution.A ?? null} loading={isLoading} />
        <KpiCard label="Sin rating" value={data?.distribution.sin_rating ?? null} invertColor loading={isLoading} />
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <RankingTable
          title="Socios estrella"
          rows={data?.stars as unknown as Record<string, unknown>[]}
          loading={isLoading}
          columns={[
            { key: "name", label: "Socio" },
            { key: "bookings_count", label: "Reservas", align: "right" },
          ]}
        />
        <RankingTable
          title="Socios en riesgo (60d sin actividad)"
          rows={data?.at_risk as unknown as Record<string, unknown>[]}
          loading={isLoading}
          columns={[
            { key: "name", label: "Socio" },
            {
              key: "last_activity",
              label: "Última actividad",
              align: "right",
              render: (r) =>
                r.last_activity
                  ? new Date(String(r.last_activity)).toLocaleDateString("es-CL")
                  : "Nunca",
            },
          ]}
        />
      </section>

      <Card className="rounded-2xl border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="font-display text-base">Funnel de desafíos</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading || !data ? (
            <div className="h-12 animate-pulse rounded-md bg-muted" />
          ) : (
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-xs uppercase text-muted-foreground">Enviados</p>
                <p className="font-display text-2xl font-semibold">{data.challenge_funnel.enviados}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground">Aceptados</p>
                <p className="font-display text-2xl font-semibold text-primary">{data.challenge_funnel.aceptados}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground">Jugados</p>
                <p className="font-display text-2xl font-semibold text-success">{data.challenge_funnel.jugados}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </AnalyticsShell>
  );
}
