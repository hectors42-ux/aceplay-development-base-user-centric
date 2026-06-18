import { AnalyticsShell } from "@/components/analytics/AnalyticsShell";
import { ClubHealthGauge } from "@/components/analytics/ClubHealthGauge";
import { Card, CardContent } from "@/components/ui/card";
import { useAnalyticsDirectory } from "@/hooks/analytics/useAnalyticsDirectory";

export default function AnalyticsDirectory() {
  const { data, isLoading } = useAnalyticsDirectory();
  const score = Number(data?.overview?.health_score ?? 0);
  const monthLabel = data ? new Date(data.month).toLocaleDateString("es-CL", { month: "long", year: "numeric" }) : "";

  return (
    <AnalyticsShell title="Resumen del directorio" subtitle="Vista ejecutiva mensual." hideFilters>
      <div className="mx-auto max-w-2xl space-y-6">
        <Card className="rounded-2xl border-border/60">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{monthLabel}</p>
            <ClubHealthGauge score={score} size={200} />
            <p className="font-display text-lg leading-relaxed text-muted-foreground">
              Salud del club este mes
            </p>
          </CardContent>
        </Card>

        {!isLoading && data && (
          <>
            <section className="grid gap-3 md:grid-cols-2">
              <Card className="rounded-2xl border-success/30 bg-success/5">
                <CardContent className="space-y-2 p-5">
                  <p className="font-display text-base font-semibold text-success">Logros</p>
                  <ul className="space-y-1 text-sm text-foreground/80">
                    {data.wins.map((w, i) => <li key={i}>• {w}</li>)}
                  </ul>
                </CardContent>
              </Card>
              <Card className="rounded-2xl border-destructive/30 bg-destructive/5">
                <CardContent className="space-y-2 p-5">
                  <p className="font-display text-base font-semibold text-destructive">Riesgos</p>
                  <ul className="space-y-1 text-sm text-foreground/80">
                    {data.risks.map((r, i) => <li key={i}>• {r}</li>)}
                  </ul>
                </CardContent>
              </Card>
            </section>
          </>
        )}
      </div>
    </AnalyticsShell>
  );
}
