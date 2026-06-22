import { AnalyticsShell } from "@/components/analytics/AnalyticsShell";
import { KpiCard } from "@/components/analytics/KpiCard";
import { RankingTable } from "@/components/analytics/RankingTable";
import { useAnalyticsCommunity } from "@/hooks/analytics/useAnalyticsCommunity";

export default function AnalyticsCommunity() {
  const { data, isLoading } = useAnalyticsCommunity();
  return (
    <AnalyticsShell title="Competencia y comunidad" subtitle="Escalerillas, desafíos y progresión deportiva.">
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        <KpiCard label="Tiempo aceptación (h)" value={data?.avg_accept_hours ?? null} loading={isLoading} />
        <KpiCard label="Tiempo a jugar (h)" value={data?.avg_play_hours ?? null} loading={isLoading} />
        <KpiCard label="Escalerillas activas" value={data?.active_ladders.length ?? null} loading={isLoading} />
        <KpiCard label="Niveles distintos" value={data?.level_density.length ?? null} loading={isLoading} />
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <RankingTable
          title="Top progreso (Δ rating)"
          rows={data?.top_progress as unknown as Record<string, unknown>[]}
          loading={isLoading}
          columns={[
            { key: "name", label: "Jugador" },
            { key: "delta", label: "Δ", align: "right", render: (r) => `+${Number(r.delta).toFixed(2)}` },
          ]}
        />
        <RankingTable
          title="Mayor caída (Δ rating)"
          rows={data?.top_decline as unknown as Record<string, unknown>[]}
          loading={isLoading}
          columns={[
            { key: "name", label: "Jugador" },
            { key: "delta", label: "Δ", align: "right", render: (r) => Number(r.delta).toFixed(2) },
          ]}
        />
      </section>

      <RankingTable
        title="Escalerillas más activas"
        rows={data?.active_ladders as unknown as Record<string, unknown>[]}
        loading={isLoading}
        columns={[
          { key: "name", label: "Escalerilla" },
          { key: "matches", label: "Partidos", align: "right" },
        ]}
      />
    </AnalyticsShell>
  );
}
