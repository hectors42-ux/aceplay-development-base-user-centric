import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, XCircle, Clock, Hand, RefreshCw, Download, ExternalLink, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { cn } from "@/lib/utils";

type Status = "pass" | "fail" | "skip" | "manual";
interface ScenarioResult {
  id: string;
  desc: string;
  module: string;
  agents: string[];
  status: Status;
  error?: string;
  evidence?: unknown;
}
interface Results {
  ts: string;
  counts: Partial<Record<Status, number>>;
  results: ScenarioResult[];
}

const STATUS_META: Record<Status, { label: string; icon: typeof CheckCircle2; cls: string }> = {
  pass:   { label: "pass",   icon: CheckCircle2, cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30" },
  fail:   { label: "fail",   icon: XCircle,      cls: "bg-destructive/10 text-destructive border-destructive/30" },
  skip:   { label: "skip",   icon: Clock,        cls: "bg-muted text-muted-foreground border-border" },
  manual: { label: "manual", icon: Hand,         cls: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30" },
};

export default function AdminQACompetir() {
  const [data, setData] = useState<Results | null>(null);
  const [markdown, setMarkdown] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      fetch(`/e2e-competir/results.json?t=${Date.now()}`).then((r) => {
        if (!r.ok) throw new Error(`results.json no encontrado (${r.status})`);
        return r.json() as Promise<Results>;
      }),
      fetch(`/e2e-competir/report.md?t=${Date.now()}`).then((r) => (r.ok ? r.text() : "")),
    ])
      .then(([json, md]) => {
        if (cancelled) return;
        setData(json);
        setMarkdown(md);
      })
      .catch((e) => !cancelled && setError(e.message ?? String(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const grouped = useMemo(() => {
    if (!data) return {} as Record<string, ScenarioResult[]>;
    return data.results.reduce<Record<string, ScenarioResult[]>>((acc, r) => {
      (acc[r.module] ??= []).push(r);
      return acc;
    }, {});
  }, [data]);

  return (
    <div className="container mx-auto max-w-md md:max-w-5xl px-4 py-6 space-y-6">
      <header className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-semibold tracking-tight">QA — Reporte E2E Competir</h1>
          <p className="text-sm text-muted-foreground">
            Resultado del runner multiagente para todos los escenarios del módulo Competir.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setReloadKey((k) => k + 1)}>
            <RefreshCw className="h-4 w-4 mr-2" /> Recargar
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href="/e2e-competir/report.md" download>
              <Download className="h-4 w-4 mr-2" /> report.md
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href="/e2e-competir/results.json" download>
              <Download className="h-4 w-4 mr-2" /> results.json
            </a>
          </Button>
        </div>
      </header>

      {loading && <p className="text-sm text-muted-foreground">Cargando reporte…</p>}

      {error && (
        <Card className="border-destructive/40">
          <CardContent className="flex items-start gap-3 p-4 text-sm">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">No se pudo cargar el reporte</p>
              <p className="text-muted-foreground">{error}</p>
              <p className="text-muted-foreground mt-2">
                Generalo con <code className="px-1 py-0.5 rounded bg-muted">npm run e2e:competir:report</code> y copialo a{" "}
                <code className="px-1 py-0.5 rounded bg-muted">public/e2e-competir/</code>.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {data && <Summary data={data} />}

      {data && (
        <Tabs defaultValue="por-modulo" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="por-modulo">Por módulo</TabsTrigger>
            <TabsTrigger value="escenarios">Escenarios</TabsTrigger>
            <TabsTrigger value="markdown">Markdown</TabsTrigger>
          </TabsList>

          <TabsContent value="por-modulo" className="space-y-4">
            {Object.entries(grouped).map(([mod, rows]) => (
              <ModuleCard key={mod} module={mod} rows={rows} />
            ))}
          </TabsContent>

          <TabsContent value="escenarios" className="space-y-3">
            <Accordion type="multiple" className="space-y-2">
              {data.results.map((r) => (
                <ScenarioRow key={r.id} r={r} />
              ))}
            </Accordion>
          </TabsContent>

          <TabsContent value="markdown">
            <Card>
              <CardContent className="p-0">
                <ScrollArea className="h-[60vh]">
                  <pre className="text-xs leading-relaxed p-4 whitespace-pre-wrap font-mono">{markdown || "(sin contenido)"}</pre>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function Summary({ data }: { data: Results }) {
  const total = data.results.length;
  const auto = data.results.filter((r) => r.status !== "manual").length;
  const passRate = auto ? Math.round(((data.counts.pass ?? 0) / auto) * 100) : 0;
  return (
    <section>
      <p className="text-xs text-muted-foreground mb-3">
        Generado: <code>{new Date(data.ts).toLocaleString("es-CL")}</code> · {total} escenarios · tasa auto: <strong>{passRate}%</strong>
      </p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(["pass", "fail", "manual", "skip"] as Status[]).map((s) => {
          const meta = STATUS_META[s];
          const Icon = meta.icon;
          return (
            <Card key={s} className={cn("border", meta.cls)}>
              <CardContent className="flex items-center gap-3 p-4">
                <Icon className="h-5 w-5" />
                <div>
                  <div className="text-2xl font-semibold leading-none">{data.counts[s] ?? 0}</div>
                  <div className="text-xs uppercase tracking-wide opacity-80">{meta.label}</div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

function ModuleCard({ module, rows }: { module: string; rows: ScenarioResult[] }) {
  const counts = rows.reduce<Record<string, number>>((a, r) => ((a[r.status] = (a[r.status] ?? 0) + 1), a), {});
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <span className="font-mono">{module}</span>
          <span className="flex flex-wrap gap-1.5">
            {(["pass", "fail", "manual", "skip"] as Status[]).map((s) =>
              counts[s] ? (
                <Badge key={s} variant="outline" className={cn("text-[10px]", STATUS_META[s].cls)}>
                  {counts[s]} {s}
                </Badge>
              ) : null,
            )}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <ul className="divide-y divide-border">
          {rows.map((r) => {
            const meta = STATUS_META[r.status];
            const Icon = meta.icon;
            return (
              <li key={r.id} className="py-2 flex items-start gap-3">
                <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", meta.cls.split(" ").find((c) => c.startsWith("text-")))} />
                <div className="flex-1 min-w-0">
                  <a
                    href={`#scenario-${r.id}`}
                    className="text-sm font-medium hover:underline flex items-center gap-1"
                  >
                    {r.id}
                    <ExternalLink className="h-3 w-3 opacity-50" />
                  </a>
                  <p className="text-xs text-muted-foreground truncate">{r.desc}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

function ScenarioRow({ r }: { r: ScenarioResult }) {
  const meta = STATUS_META[r.status];
  const Icon = meta.icon;
  return (
    <AccordionItem value={r.id} id={`scenario-${r.id}`} className="border rounded-md px-3">
      <AccordionTrigger className="hover:no-underline py-3">
        <div className="flex items-center gap-3 flex-1 min-w-0 text-left">
          <Badge variant="outline" className={cn("shrink-0", meta.cls)}>
            <Icon className="h-3 w-3 mr-1" />
            {meta.label}
          </Badge>
          <span className="font-mono text-sm shrink-0">{r.id}</span>
          <span className="text-sm text-muted-foreground truncate">{r.desc}</span>
        </div>
      </AccordionTrigger>
      <AccordionContent className="space-y-3 pb-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
          <Meta label="Módulo" value={r.module} />
          <Meta label="Agentes" value={r.agents.join(", ") || "—"} />
          <Meta label="Estado" value={r.status} />
        </div>
        {r.error && (
          <div className="rounded border border-destructive/40 bg-destructive/5 p-3">
            <p className="text-xs font-semibold text-destructive mb-1">Error</p>
            <pre className="text-xs whitespace-pre-wrap font-mono text-destructive/90">{r.error}</pre>
          </div>
        )}
        {r.evidence != null && (
          <div className="rounded border bg-muted/30 p-3">
            <p className="text-xs font-semibold mb-1">Evidencia</p>
            <ScrollArea className="max-h-64">
              <pre className="text-xs whitespace-pre-wrap font-mono">{JSON.stringify(r.evidence, null, 2)}</pre>
            </ScrollArea>
          </div>
        )}
      </AccordionContent>
    </AccordionItem>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border bg-card px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-mono truncate">{value}</div>
    </div>
  );
}
