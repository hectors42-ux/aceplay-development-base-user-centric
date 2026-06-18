import { AnalyticsShell } from "@/components/analytics/AnalyticsShell";
import { KpiCard } from "@/components/analytics/KpiCard";
import { ComingSoonCard } from "@/components/analytics/ComingSoonCard";
import { useAnalyticsFinance } from "@/hooks/analytics/useAnalyticsFinance";

const fmtCLP = (v: number | null | undefined) =>
  v == null ? "—" : new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(v);

export default function AnalyticsFinance() {
  const { data, isLoading } = useAnalyticsFinance();
  return (
    <AnalyticsShell title="Finanzas y cobranza" subtitle="Ingresos por línea de negocio y estado de mora.">
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        <KpiCard label="Ingresos clases" value={fmtCLP(data?.clases_revenue_clp)} loading={isLoading} />
        <ComingSoonCard label="Ingresos cuotas" reason="Disponible cuando se active Webpay (S3)." />
        <ComingSoonCard label="Ingresos reservas" reason="Disponible cuando se active Webpay (S3)." />
        <ComingSoonCard label="Ingresos torneos" reason="Disponible cuando se active Webpay (S3)." />
        <KpiCard label="Morosos" value={data?.morosos_total ?? null} invertColor loading={isLoading} />
        <KpiCard label="Mora 30d" value={data?.morosos_30d ?? null} invertColor loading={isLoading} />
        <KpiCard label="Mora 60d" value={data?.morosos_60d ?? null} invertColor loading={isLoading} />
        <KpiCard label="Mora 90d+" value={data?.morosos_90d ?? null} invertColor loading={isLoading} />
      </section>
    </AnalyticsShell>
  );
}
