import { useState } from "react";
import { AnalyticsShell } from "@/components/analytics/AnalyticsShell";
import { AlertCard } from "@/components/analytics/AlertCard";
import { EmptyAnalyticsState } from "@/components/analytics/EmptyAnalyticsState";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useAnalyticsAlerts } from "@/hooks/analytics/useAnalyticsAlerts";

const AUTOMATIONS = [
  { title: "Campaña automática a socios inactivos", body: "Email semanal a socios sin actividad ≥ 60d." },
  { title: "Recordatorio automático de mora", body: "Notificación push y email a socios morosos." },
  { title: "Promo automática en horarios valle", body: "Descuento aplicado a slots con baja ocupación." },
  { title: "Resumen semanal al gerente", body: "Digest del lunes con KPIs principales." },
  { title: "Resumen mensual al directorio", body: "Reporte ejecutivo en PDF cada mes." },
];

export default function AnalyticsAlerts() {
  const { data, isLoading } = useAnalyticsAlerts();
  const critical = (data ?? []).filter((a) => a.kind === "critical");
  const opportunities = (data ?? []).filter((a) => a.kind === "opportunity");
  const [tab, setTab] = useState("critical");

  return (
    <AnalyticsShell title="Alertas y automatizaciones" subtitle="Centro de inteligencia operativa." hideFilters>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="critical">Críticas ({critical.length})</TabsTrigger>
          <TabsTrigger value="opportunities">Oportunidades ({opportunities.length})</TabsTrigger>
          <TabsTrigger value="automations">Automatizaciones</TabsTrigger>
        </TabsList>
        <TabsContent value="critical" className="space-y-2">
          {isLoading ? (
            <div className="h-20 animate-pulse rounded-2xl bg-muted/40" />
          ) : critical.length === 0 ? (
            <EmptyAnalyticsState title="Sin alertas críticas" description="El club está operando dentro de los umbrales esperados." />
          ) : (
            critical.map((a, i) => (
              <AlertCard key={i} variant="critical" title={a.title} body={a.body} actionUrl={a.action_url} />
            ))
          )}
        </TabsContent>
        <TabsContent value="opportunities" className="space-y-2">
          {isLoading ? (
            <div className="h-20 animate-pulse rounded-2xl bg-muted/40" />
          ) : opportunities.length === 0 ? (
            <EmptyAnalyticsState title="Sin oportunidades detectadas" description="Volveremos a evaluar pronto con más actividad del club." />
          ) : (
            opportunities.map((a, i) => (
              <AlertCard key={i} variant="opportunity" title={a.title} body={a.body} actionUrl={a.action_url} />
            ))
          )}
        </TabsContent>
        <TabsContent value="automations" className="space-y-2">
          {AUTOMATIONS.map((a, i) => (
            <Card key={i} className="rounded-2xl border-border/60">
              <CardContent className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="font-display text-sm font-semibold">{a.title}</p>
                  <p className="text-xs text-muted-foreground">{a.body}</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Próximamente</span>
                  <Switch disabled />
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </AnalyticsShell>
  );
}
