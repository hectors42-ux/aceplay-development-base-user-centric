import { Activity, Coins, Trophy, Users, Calendar, Swords } from "lucide-react";
import { AnalyticsShell } from "@/components/analytics/AnalyticsShell";
import { KpiCard } from "@/components/analytics/KpiCard";
import { AlertCard } from "@/components/analytics/AlertCard";
import { ClubHealthGauge } from "@/components/analytics/ClubHealthGauge";
import { RankingTable } from "@/components/analytics/RankingTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAnalyticsOverview } from "@/hooks/analytics/useAnalyticsOverview";
import { useAnalyticsAlerts } from "@/hooks/analytics/useAnalyticsAlerts";

const fmtCLP = (v: number | null | undefined) =>
  v == null ? "—" : new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(v);

export default function AnalyticsOverview() {
  const { data, isLoading } = useAnalyticsOverview();
  const { data: alerts, isLoading: alertsLoading } = useAnalyticsAlerts();
  const top = (alerts ?? []).slice(0, 4);

  return (
    <AnalyticsShell title="Hoy en el club" subtitle="Estado general en menos de 60 segundos.">
      <Card className="rounded-2xl border-border/60">
        <CardContent className="flex flex-col items-center justify-center gap-2 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Salud del club</p>
          {isLoading ? (
            <div className="h-40 w-40 animate-pulse rounded-full bg-muted" />
          ) : (
            <ClubHealthGauge score={data?.health_score ?? 0} />
          )}
        </CardContent>
      </Card>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        <KpiCard
          label="Ocupación"
          value={data ? `${data.occupancy_pct}%` : null}
          delta={data?.occupancy_delta_pp}
          deltaSuffix="pp"
          hint="Reservas confirmadas vs capacidad disponible en el período."
          icon={<Activity className="h-3.5 w-3.5" />}
          loading={isLoading}
        />
        <KpiCard
          label="Ingresos clases"
          value={fmtCLP(data?.clases_revenue_clp)}
          hint="Pagos confirmados de clases en el período."
          icon={<Coins className="h-3.5 w-3.5" />}
          loading={isLoading}
        />
        <KpiCard
          label="Mora"
          value={data?.morosos ?? null}
          invertColor
          hint="Socios con cuotas pendientes."
          icon={<Coins className="h-3.5 w-3.5" />}
          loading={isLoading}
        />
        <KpiCard
          label="Socios activos 30d"
          value={data?.active_members_30d ?? null}
          icon={<Users className="h-3.5 w-3.5" />}
          loading={isLoading}
        />
        <KpiCard
          label="Inactivos 30d"
          value={data?.inactive_members_30d ?? null}
          invertColor
          icon={<Users className="h-3.5 w-3.5" />}
          loading={isLoading}
        />
        <KpiCard
          label="Torneos activos"
          value={data?.active_tournaments ?? null}
          icon={<Trophy className="h-3.5 w-3.5" />}
          loading={isLoading}
        />
        <KpiCard
          label="Desafíos activos"
          value={data?.active_challenges ?? null}
          icon={<Swords className="h-3.5 w-3.5" />}
          loading={isLoading}
        />
        <KpiCard
          label="Partidos 7d"
          value={data?.matches_played_week ?? null}
          icon={<Calendar className="h-3.5 w-3.5" />}
          loading={isLoading}
        />
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-lg font-semibold">Qué requiere atención hoy</h2>
        {alertsLoading ? (
          <div className="grid gap-2 md:grid-cols-2">
            {[0, 1].map((i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted/40" />)}
          </div>
        ) : top.length === 0 ? (
          <Card className="rounded-2xl border-border/60 bg-success/5">
            <CardContent className="p-4 text-sm text-success">
              Todo en orden. No hay alertas críticas activas.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {top.map((a, i) => (
              <AlertCard
                key={i}
                variant={a.kind === "critical" ? "critical" : "opportunity"}
                title={a.title}
                body={a.body}
                actionUrl={a.action_url}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <RankingTable
          title="Top coaches del período"
          rows={data?.top_coaches as unknown as Record<string, unknown>[]}
          loading={isLoading}
          columns={[
            { key: "name", label: "Coach" },
            { key: "classes", label: "Clases", align: "right" },
            { key: "revenue", label: "Ingresos", align: "right", render: (r) => fmtCLP(Number(r.revenue)) },
          ]}
        />
      </section>
    </AnalyticsShell>
  );
}
