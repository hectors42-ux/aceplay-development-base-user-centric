import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Play, RefreshCw, Trash2, ExternalLink, AlertCircle, CheckCircle2, Trophy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface DemoTournament {
  tournament_id: string;
  name: string;
  label: string | null;
  status: string;
  matches_total: number;
  matches_played: number;
  closed_at: string | null;
}

interface DemoStatus {
  tenant_slug: string;
  bots_present: number;
  demo_tournaments: number;
  demo_matches: number;
  tournaments: DemoTournament[];
  checked_at: string;
  bots_created?: number;
  errors?: { label: string; motor: string; error: string }[];
}

const STATUS_VARIANT: Record<string, string> = {
  borrador: "bg-muted text-muted-foreground",
  inscripciones_abiertas: "bg-blue-500/10 text-blue-700 border-blue-500/30",
  inscripciones_cerradas: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  en_curso: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
  finalizado: "bg-primary/10 text-primary border-primary/30",
  cancelado: "bg-destructive/10 text-destructive border-destructive/30",
};

export default function AdminDemoProtocol() {
  const { toast } = useToast();
  const [status, setStatus] = useState<DemoStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<null | "seed" | "wipe" | "wipe-bots" | "refresh">(null);
  const [errors, setErrors] = useState<DemoStatus["errors"]>([]);
  const [americanoRunning, setAmericanoRunning] = useState(false);
  const [americanoResult, setAmericanoResult] = useState<null | {
    tournaments: { label: string; state: string; tournament_id: string }[];
    errors: { label: string; state: string; error: string }[];
  }>(null);

  const refresh = async () => {
    setRunning("refresh");
    const { data, error } = await supabase.rpc("demo_protocol_status");
    setRunning(null);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    setStatus(data as unknown as DemoStatus);
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      await refresh();
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSeed = async () => {
    setRunning("seed");
    const { data, error } = await supabase.rpc("demo_protocol_seed");
    setRunning(null);
    if (error) {
      toast({ title: "Error sembrando", description: error.message, variant: "destructive" });
      return;
    }
    const result = data as unknown as DemoStatus;
    setStatus(result);
    setErrors(result.errors ?? []);
    toast({
      title: "Protocolo sembrado",
      description: `${result.demo_tournaments} torneos · ${result.demo_matches} partidos · ${result.bots_present} jugadores bot.`,
    });
  };

  const handleWipe = async (wipeBots: boolean) => {
    const confirmMsg = wipeBots
      ? "¿Borrar TODO el protocolo + los 200 jugadores bot? Esta acción no se puede deshacer."
      : "¿Borrar los torneos y partidos del protocolo demo? Los 200 jugadores bot se conservan.";
    if (!window.confirm(confirmMsg)) return;
    setRunning(wipeBots ? "wipe-bots" : "wipe");
    const { data, error } = await supabase.rpc("demo_protocol_wipe", { _wipe_bots: wipeBots });
    setRunning(null);
    if (error) {
      toast({ title: "Error limpiando", description: error.message, variant: "destructive" });
      return;
    }
    const summary = data as { tournaments_deleted: number; bots_deleted: number };
    toast({
      title: "Simulación limpiada",
      description: `${summary.tournaments_deleted} torneos borrados · ${summary.bots_deleted} bots borrados.`,
    });
    setErrors([]);
    await refresh();
  };

  const handleSeedAmericano = async () => {
    setAmericanoRunning(true);
    const { data, error } = await supabase.rpc("demo_seed_padel_americano_protocolo");
    setAmericanoRunning(false);
    if (error) {
      toast({
        title: "Error sembrando Pádel Americano",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    const result = data as {
      tournaments: { label: string; state: string; tournament_id: string }[];
      errors: { label: string; state: string; error: string }[];
    };
    setAmericanoResult(result);
    toast({
      title: "Pádel Americano sembrado",
      description: `${result.tournaments.length} torneos creados · ${result.errors.length} errores.`,
    });
    await refresh();
  };

  return (
    <div className="container mx-auto max-w-md md:max-w-5xl px-4 py-6 space-y-6">
      <header>
        <h1 className="font-display text-2xl md:text-3xl font-semibold tracking-tight">
          Protocolo de pruebas demo
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Siembra el club AcePlay Demo con 200 jugadores bot + torneos en distintos estados para
          que <code>demouser@aceplay.cl</code> y <code>hectors42@gmail.com</code> vean datos reales.
          Los flujos están mapeados a los bloques A–F del protocolo manual.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Acciones</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button onClick={handleSeed} disabled={!!running}>
            {running === "seed" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
            Ejecutar protocolo
          </Button>
          <Button variant="outline" onClick={refresh} disabled={!!running}>
            {running === "refresh" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Refrescar estado
          </Button>
          <Button variant="outline" onClick={() => handleWipe(false)} disabled={!!running}>
            {running === "wipe" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
            Limpiar torneos
          </Button>
          <Button variant="destructive" onClick={() => handleWipe(true)} disabled={!!running}>
            {running === "wipe-bots" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
            Limpiar todo (incl. bots)
          </Button>
        </CardContent>
      </Card>

      {errors && errors.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Algunos torneos no se pudieron sembrar</AlertTitle>
          <AlertDescription>
            <ul className="mt-2 space-y-1 text-sm">
              {errors.map((e) => (
                <li key={e.label}>
                  <strong>{e.label}</strong> ({e.motor}): {e.error}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Resumen</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : status ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <Stat label="Tenant" value={status.tenant_slug} />
              <Stat label="Jugadores bot" value={status.bots_present} />
              <Stat label="Torneos demo" value={status.demo_tournaments} />
              <Stat label="Partidos demo" value={status.demo_matches} />
            </div>
          ) : (
            <p className="text-sm text-destructive">Sin datos.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Torneos sembrados</CardTitle>
        </CardHeader>
        <CardContent>
          {!status || status.tournaments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay torneos del protocolo. Pulsa <em>Ejecutar protocolo</em>.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {status.tournaments.map((t) => (
                <li key={t.tournament_id} className="py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{t.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t.matches_played}/{t.matches_total} partidos jugados
                      {t.closed_at && " · cerrado"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className={STATUS_VARIANT[t.status] ?? ""}>
                      {t.status}
                    </Badge>
                    <Button asChild size="sm" variant="ghost">
                      <Link to={`/admin/torneos/${t.tournament_id}`}>
                        Ver <ExternalLink className="ml-1 h-3 w-3" />
                      </Link>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Alert>
        <CheckCircle2 className="h-4 w-4" />
        <AlertTitle>Cómo verificar visualmente</AlertTitle>
        <AlertDescription className="text-sm">
          Loguéate como <code>demouser@aceplay.cl</code> o <code>hectors42@gmail.com</code> y
          navega a <Link to="/torneos" className="underline">/torneos</Link>,{" "}
          <Link to="/mis-torneos" className="underline">/mis-torneos</Link> y{" "}
          <Link to="/perfil" className="underline">/perfil</Link>. Verás el contenido sembrado
          como si fuera real.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="h-4 w-4" />
            Pádel Americano · Torneo demo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Siembra el torneo del docx oficial (pádel dobles · 20 parejas · 4 grupos x 5 · cuartos · semis · final · set único con punto de oro) en <strong>5 estados</strong> distintos del
            ciclo, con <code>demouser@aceplay.cl</code> inscrito como pareja del Grupo A en todos
            ellos.
          </p>
          <Button onClick={handleSeedAmericano} disabled={americanoRunning}>
            {americanoRunning ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Play className="mr-2 h-4 w-4" />
            )}
            Sembrar 5 escenarios
          </Button>
          {americanoResult && (
            <div className="space-y-2">
              <ul className="divide-y divide-border rounded-lg border border-border">
                {americanoResult.tournaments.map((t) => (
                  <li
                    key={t.tournament_id}
                    className="flex items-center justify-between gap-3 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{t.label}</p>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                        {t.state}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button asChild size="sm" variant="ghost">
                        <Link to={`/admin/torneos/${t.tournament_id}`}>
                          Admin <ExternalLink className="ml-1 h-3 w-3" />
                        </Link>
                      </Button>
                      <Button asChild size="sm" variant="ghost">
                        <Link to={`/torneos/${t.tournament_id}`}>
                          Vista pública <ExternalLink className="ml-1 h-3 w-3" />
                        </Link>
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
              {americanoResult.errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Errores</AlertTitle>
                  <AlertDescription>
                    <ul className="mt-2 space-y-1 text-sm">
                      {americanoResult.errors.map((e) => (
                        <li key={e.label}>
                          <strong>{e.label}</strong>: {e.error}
                        </li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

const Stat = ({ label, value }: { label: string; value: string | number }) => (
  <div className="rounded-lg border border-border bg-card p-3">
    <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
    <p className="mt-1 font-display text-lg">{value}</p>
  </div>
);