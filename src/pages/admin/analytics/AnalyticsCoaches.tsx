import { AnalyticsShell } from "@/components/analytics/AnalyticsShell";
import { RankingTable } from "@/components/analytics/RankingTable";
import { useAnalyticsCoaches } from "@/hooks/analytics/useAnalyticsCoaches";

const fmtCLP = (v: number | null | undefined) =>
  v == null ? "—" : new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(v);

export default function AnalyticsCoaches() {
  const { data, isLoading } = useAnalyticsCoaches();
  return (
    <AnalyticsShell title="Coaches y academia" subtitle="Ocupación, ingresos y demanda por coach.">
      <RankingTable
        title="Performance de coaches"
        rows={data as unknown as Record<string, unknown>[]}
        loading={isLoading}
        columns={[
          { key: "name", label: "Coach" },
          { key: "classes", label: "Clases", align: "right" },
          { key: "revenue_clp", label: "Ingresos", align: "right", render: (r) => fmtCLP(Number(r.revenue_clp)) },
          { key: "avg_ticket_clp", label: "Ticket prom.", align: "right", render: (r) => fmtCLP(Number(r.avg_ticket_clp)) },
          { key: "cancelled", label: "Canceladas", align: "right" },
        ]}
      />
    </AnalyticsShell>
  );
}
