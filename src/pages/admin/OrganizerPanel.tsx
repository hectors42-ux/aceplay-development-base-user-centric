import { Link } from "react-router-dom";
import { ArrowLeft, BarChart3, Loader2, Flag, Receipt, CheckCircle2 } from "lucide-react";
import { useOrganizerPanel, useOrganizerRevenue, useOrganizerFinalizable, useFinalizeTournament } from "@/hooks/useOrganizer";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const pct = (n: number | null) => `${Math.round((n ?? 0) * 100)}%`;
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" });
const REVENUE_LABEL: Record<string, string> = { saas: "SaaS", convenience_fee: "Conveniencia", pro_engine: "Motor pro", sponsorship: "Sponsorship" };

// Medidor read-only de una métrica cruda (0..1). NO es un score de mérito.
const Meter = ({ label, value }: { label: string; value: number | null }) => (
  <div>
    <div className="mb-0.5 flex items-center justify-between text-[11px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums">{pct(value)}</span>
    </div>
    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
      <div className="h-full rounded-full bg-primary" style={{ width: pct(value) }} />
    </div>
  </div>
);

const OrganizerPanel = () => {
  const { data: metrics = [], isLoading } = useOrganizerPanel();
  const { data: revenue = [] } = useOrganizerRevenue();
  const { data: finalizable = [] } = useOrganizerFinalizable();
  const finalize = useFinalizeTournament();

  const onFinalize = (id: string, name: string) => {
    finalize.mutate(id, {
      onSuccess: () => toast.success(`"${name}" finalizado. Métricas capturadas.`),
      onError: (e) => toast.error(e.message),
    });
  };

  return (
    <div className="mx-auto max-w-md px-5 py-6">
      <div className="mb-5 flex items-center gap-3">
        <Link to="/perfil" className="flex h-9 w-9 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground"><ArrowLeft className="h-4 w-4" /></Link>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Organizador</p>
          <h1 className="flex items-center gap-2 font-display text-xl font-semibold"><BarChart3 className="h-5 w-5 text-primary" /> Métricas</h1>
        </div>
      </div>
      <p className="mb-4 text-[11px] text-muted-foreground">Datos crudos de captura por torneo (completitud, retención, calidad del dato). Sin índice de mérito ni ranking.</p>

      {/* Acción: finalizar torneos (separada del panel read-only) */}
      {finalizable.length > 0 && (
        <div className="mb-5">
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"><Flag className="h-3 w-3" /> Por finalizar</p>
          <div className="space-y-2">
            {finalizable.map((t) => (
              <div key={t.tournament_id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-card">
                <p className="min-w-0 flex-1 truncate text-sm font-medium">{t.name}</p>
                <Button size="sm" variant="clay" className="h-8" disabled={finalize.isPending} onClick={() => onFinalize(t.tournament_id, t.name)}>
                  {finalize.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Finalizar"}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Panel SOLO LECTURA: métricas crudas por torneo */}
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Métricas capturadas</p>
      {isLoading ? (
        <div className="space-y-2">{[0, 1].map((i) => <Skeleton key={i} className="h-28 w-full rounded-2xl" />)}</div>
      ) : metrics.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">Aún no hay torneos finalizados con métricas.</p>
      ) : (
        <div className="space-y-3">
          {metrics.map((m) => (
            <div key={m.tournament_id} className="rounded-2xl border border-border bg-card p-4 shadow-card">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="min-w-0 truncate font-display text-sm font-semibold">{m.tournament_name}</p>
                <span className={cn("flex shrink-0 items-center gap-1 text-[10px] font-semibold uppercase",
                  m.status === "finished" ? "text-success" : "text-muted-foreground")}>
                  {m.status === "finished" && <CheckCircle2 className="h-3 w-3" />}{m.status}
                </span>
              </div>
              <div className="space-y-2">
                <Meter label="Completitud" value={m.completion_rate} />
                <Meter label="Retención" value={m.retention} />
                <Meter label="Calidad del dato" value={m.data_quality} />
              </div>
              <p className="mt-2 text-[10px] text-muted-foreground">{m.organizer_name} · capturado {fmtDate(m.captured_at)}</p>
            </div>
          ))}
        </div>
      )}

      {/* Registro de ingresos (read-only, sin montos = no cobro) */}
      {revenue.length > 0 && (
        <>
          <p className="mb-2 mt-6 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"><Receipt className="h-3 w-3" /> Registro de ingresos</p>
          <div className="space-y-2">
            {revenue.map((r) => (
              <div key={r.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-card">
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">{REVENUE_LABEL[r.type] ?? r.type}</span>
                <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{r.ref ?? "—"}</p>
                <span className="shrink-0 text-[10px] text-muted-foreground">{fmtDate(r.created_at)}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground">Registro no-custodial: AcePlay no retiene el pozo ni cobra inscripciones.</p>
        </>
      )}
    </div>
  );
};

export default OrganizerPanel;
