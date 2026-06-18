import { useState } from "react";
import { Download, FileText, Loader2, RefreshCw, Share2, Trophy, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useTournamentReport } from "@/hooks/useTournamentReport";
import { AVE_DISCLAIMER } from "@/lib/ave";

function formatClp(value: number): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(value);
}

function Bar({ pct }: { pct: number }) {
  const w = Math.max(0, Math.min(100, pct));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div className="h-full bg-primary transition-all" style={{ width: `${w}%` }} />
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-mono text-[11px] font-semibold uppercase tracking-[0.32em] text-muted-foreground">
      {children}
    </h3>
  );
}

function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-3xl font-semibold leading-none text-foreground">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function TournamentReportTab({ tournamentId }: { tournamentId: string }) {
  const { report, loading, error, refresh } = useTournamentReport(tournamentId);
  const [exporting, setExporting] = useState<"pdf" | "csv" | null>(null);

  const handleExport = async (format: "pdf" | "csv") => {
    setExporting(format);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error("Sin sesión");
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/export-tournament`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tournament_id: tournamentId, mode: "report", format }),
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = format === "pdf" ? "informe.pdf" : "eventos.csv";
      a.click();
      URL.revokeObjectURL(a.href);
      toast({ title: "Listo", description: format === "pdf" ? "Informe descargado." : "CSV descargado." });
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "No se pudo exportar",
        variant: "destructive",
      });
    } finally {
      setExporting(null);
    }
  };

  if (loading && !report) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Calculando métricas…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-6 text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (!report) return null;

  const snap = new Date(report.snapshot_at).toLocaleString("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const cobrandName = report.tournament.cobrand?.display_name;

  return (
    <div className="space-y-5">
      {/* Hero */}
      <header className="space-y-1">
        <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-muted-foreground">
          Informe del torneo
        </p>
        <h2 className="font-display text-2xl font-semibold text-foreground">
          {report.tournament.name}
          {cobrandName && (
            <span className="ml-2 font-display italic text-primary">· {cobrandName}</span>
          )}
        </h2>
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Snapshot: {snap}</p>
          <Button size="sm" variant="ghost" onClick={() => refresh()} disabled={loading}>
            <RefreshCw className={`mr-1 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
        </div>
      </header>

      {/* Participación */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <SectionTitle>Participación</SectionTitle>
        <div className="mt-3 grid grid-cols-2 gap-4 md:grid-cols-3">
          <Stat
            label="Confirmados"
            value={`${report.participation.confirmed_players}${
              report.participation.total_slots > 0 ? ` / ${report.participation.total_slots}` : ""
            }`}
            hint={`${report.participation.fill_rate}% de ocupación`}
          />
          <Stat label="Categorías" value={report.participation.category_count} />
          <Stat label="Sesiones" value={report.participation.session_count} />
          <Stat label="Canchas" value={report.participation.court_count} />
          <Stat label="Operadores" value={report.operators.count} />
          <Stat
            label="Partidos"
            value={`${report.play.matches_played} / ${report.play.matches_total}`}
            hint={`${report.play.completion_rate}% completados`}
          />
        </div>
        {report.participation.total_slots > 0 && (
          <div className="mt-4">
            <Bar pct={report.participation.fill_rate} />
          </div>
        )}
      </section>

      {/* Compartido */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <SectionTitle>Compartido</SectionTitle>
        {report.share.opens === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
            <Share2 className="mr-2 inline h-4 w-4" />
            Aún sin compartidos. Cuando los jugadores abran y compartan sus cards aparecerán acá.
          </p>
        ) : (
          <>
            <div className="mt-3 grid grid-cols-2 gap-4 md:grid-cols-4">
              <Stat label="Opens" value={report.share.opens} />
              <Stat label="Descargas" value={report.share.downloads} />
              <Stat label="Compartidos" value={report.share.shares} />
              <Stat
                label="Únicos"
                value={report.share.unique_users}
                hint={
                  report.participation.confirmed_players > 0
                    ? `${Math.round(
                        (report.share.unique_users / report.participation.confirmed_players) * 100,
                      )}% de los confirmados`
                    : undefined
                }
              />
            </div>
            {report.share.top_kinds.length > 0 && (
              <p className="mt-4 text-xs text-muted-foreground">
                Top kind:{" "}
                {report.share.top_kinds.map((k, i) => (
                  <span key={k.kind}>
                    <span className="font-semibold text-foreground">{k.kind}</span> ({k.count})
                    {i < report.share.top_kinds.length - 1 ? " · " : ""}
                  </span>
                ))}
              </p>
            )}
          </>
        )}
      </section>

      {/* Captación */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <SectionTitle>Captación</SectionTitle>
        {report.captacion.activate_clicks === 0 && report.captacion.conversions === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
            <Users className="mr-2 inline h-4 w-4" />
            Métricas de captación se activan al desplegar PRD 9.
          </p>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-4 md:grid-cols-3">
            <Stat label="Clicks «Activar mi nivel»" value={report.captacion.activate_clicks} />
            <Stat label="Conversiones" value={report.captacion.conversions} />
            <Stat
              label="Tasa"
              value={`${report.captacion.conversion_rate}%`}
              hint="conversión sobre clicks"
            />
          </div>
        )}
      </section>

      {/* Valor publicitario */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <SectionTitle>Valor publicitario estimado</SectionTitle>
        <div className="mt-3 flex items-baseline gap-2">
          <Trophy className="h-5 w-5 text-primary" />
          <p className="font-display text-4xl font-semibold text-foreground">
            {formatClp(report.ave_clp)}
          </p>
          <span className="text-xs text-muted-foreground">*</span>
        </div>
        <p className="mt-2 text-xs italic text-muted-foreground">* {AVE_DISCLAIMER}</p>
      </section>

      {/* Acciones */}
      <div className="flex flex-col gap-2 md:flex-row">
        <Button onClick={() => handleExport("pdf")} disabled={exporting !== null} className="flex-1">
          {exporting === "pdf" ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <FileText className="mr-1 h-4 w-4" />
          )}
          Exportar PDF cobrand
        </Button>
        <Button
          variant="outline"
          onClick={() => handleExport("csv")}
          disabled={exporting !== null}
          className="flex-1"
        >
          {exporting === "csv" ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-1 h-4 w-4" />
          )}
          CSV de eventos
        </Button>
      </div>
    </div>
  );
}