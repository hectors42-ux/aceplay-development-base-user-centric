import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Download, FileSpreadsheet, FileText, Loader2, Lock, Pencil, Plus, RotateCcw, ShieldOff, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TournamentCalendarPanel } from "@/components/tournaments/TournamentCalendarPanel";
import { TournamentFormDialog } from "@/components/tournaments/TournamentFormDialog";
import { CategoryWizard } from "@/components/tournaments/CategoryWizard";
import { OrganizerSummary } from "@/components/tournaments/OrganizerSummary";
import { TournamentClosureTab } from "@/components/tournaments/TournamentClosureTab";
import { SessionsTab } from "@/components/tournaments/admin/SessionsTab";
import { OperatorsTab } from "@/components/tournaments/admin/OperatorsTab";
import { CobrandTab } from "@/components/tournaments/admin/CobrandTab";
import { RulesTab } from "@/components/tournaments/admin/RulesTab";
import { TournamentReportTab } from "@/components/tournaments/admin/TournamentReportTab";
import { MembershipOfferTab } from "@/components/tournaments/admin/MembershipOfferTab";
import type { ClosingSummary } from "@/hooks/useOrganizerHistory";
import { toast } from "@/hooks/use-toast";
import {
  GENDER_LABEL,
  TOURNAMENT_STATUS_LABEL,
  tournamentStatusColor,
  type TournamentStatus,
} from "@/lib/tournament-utils";
import { getPresetLabel } from "@/lib/tournament-presets";
import type { Tables } from "@/integrations/supabase/types";

type Tournament = Tables<"tournaments">;
type Category = Tables<"tournament_categories">;

const AdminTorneoDetalle = () => {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [playedByCat, setPlayedByCat] = useState<Map<string, number>>(new Map());

  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState<"pdf" | "xlsx" | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const handleExport = async (format: "pdf" | "xlsx") => {
    if (!tournament) return;
    setExporting(format);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/export-tournament`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ tournament_id: tournament.id, format }),
      });
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const blob = await res.blob();
      const filename = `${tournament.slug || "torneo"}.${format}`;
      const dlUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = dlUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(dlUrl);
      toast({ title: "Exportación lista", description: filename });
    } catch (err) {
      toast({
        title: "Error al exportar",
        description: err instanceof Error ? err.message : "Inténtalo nuevamente",
        variant: "destructive",
      });
    } finally {
      setExporting(null);
    }
  };

  const load = async () => {
    if (!id) return;
    const [{ data: t }, { data: cats }] = await Promise.all([
      supabase.from("tournaments").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("tournament_categories")
        .select("*")
        .eq("tournament_id", id)
        .order("sort_order")
        .order("created_at"),
    ]);
    setTournament(t);
    setCategories(cats ?? []);
    const { data: matches } = await supabase
      .from("tournament_matches")
      .select("tournament_category_id,status")
      .eq("tournament_id", id);
    const played = new Map<string, number>();
    (matches ?? []).forEach((m) => {
      if (m.status === "jugado") {
        played.set(m.tournament_category_id, (played.get(m.tournament_category_id) ?? 0) + 1);
      }
    });
    setPlayedByCat(played);
    setLoading(false);
  };

  useEffect(() => {
    (async () => {
      if (!id) return;
      const { data, error } = await supabase.rpc("is_tournament_manager", { _tournament_id: id });
      if (error) {
        setAllowed(false);
      } else {
        setAllowed(!!data);
      }
      if (data) await load();
      else setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleDeleteCategory = async (catId: string) => {
    if (!confirm("¿Eliminar esta categoría?")) return;
    const { error } = await supabase.from("tournament_categories").delete().eq("id", catId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Categoría eliminada" });
    load();
  };

  const handleReopenCategory = async (catId: string) => {
    if (
      !confirm(
        "Reabrir esta categoría borrará el cuadro generado y volverá a habilitar inscripciones. Solo se puede hacer si no se jugó ningún partido. ¿Continuar?",
      )
    )
      return;
    const { error } = await supabase.rpc("reopen_category", { _category_id: catId });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Categoría reabierta" });
    load();
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-warm">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (allowed === false) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-gradient-warm px-6 text-center">
        <ShieldOff className="h-10 w-10 text-muted-foreground" />
        <p className="font-display text-lg font-semibold">Sin acceso</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          No eres organizador, administrador del club ni super admin de este torneo.
        </p>
        <Link to="/admin/torneos" className="text-sm text-primary underline">
          Volver
        </Link>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-gradient-warm">
        <p className="text-sm text-muted-foreground">Torneo no encontrado</p>
        <Link to="/admin/torneos" className="text-sm text-primary underline">
          Volver
        </Link>
      </div>
    );
  }

  const status = tournament.status as TournamentStatus;

  return (
    <div className="min-h-screen bg-gradient-warm pb-12">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-5 py-4">
          <Link
            to="/admin/torneos"
            className="flex h-9 w-9 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground hover:text-foreground"
            aria-label="Volver"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-lg font-semibold">{tournament.name}</h1>
            <p className="text-xs text-muted-foreground">{categories.length} categorías</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="shrink-0"
            onClick={() => setEditOpen(true)}
          >
            <Pencil className="mr-1 h-4 w-4" /> Editar
          </Button>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${tournamentStatusColor(status)}`}
          >
            {TOURNAMENT_STATUS_LABEL[status]}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 px-5 pt-4">
        <Tabs defaultValue="resumen">
          <TabsList className="grid w-full grid-cols-4 gap-1 md:grid-cols-11">
            <TabsTrigger value="resumen">Resumen</TabsTrigger>
            <TabsTrigger value="categorias">Categorías</TabsTrigger>
            <TabsTrigger value="sesiones">Sesiones</TabsTrigger>
            <TabsTrigger value="operadores">Operadores</TabsTrigger>
            <TabsTrigger value="calendario">Calendario</TabsTrigger>
            <TabsTrigger value="cobrand">Co-marca</TabsTrigger>
            <TabsTrigger value="reglamento">Reglamento</TabsTrigger>
            <TabsTrigger value="config">Config</TabsTrigger>
            <TabsTrigger value="cierre">Cierre</TabsTrigger>
            <TabsTrigger value="informe">Informe</TabsTrigger>
            <TabsTrigger value="captacion">Captación</TabsTrigger>
          </TabsList>

          <TabsContent value="resumen" className="mt-4">
            <OrganizerSummary
              tournamentId={tournament.id}
              tournament={{
                starts_at: (tournament as { starts_at?: string | null }).starts_at ?? null,
                ends_at: (tournament as { ends_at?: string | null }).ends_at ?? null,
              }}
            />
          </TabsContent>

          <TabsContent value="categorias" className="mt-4">
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Categorías
                </h3>
                <Button size="sm" onClick={() => setOpen(true)}>
                  <Plus className="mr-1 h-4 w-4" /> Agregar
                </Button>
              </div>

              {categories.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-border bg-card/50 p-6 text-center text-sm text-muted-foreground">
                  Crea las categorías del torneo (Singles A, B, C, Damas, Dobles…).
                </p>
              ) : (
                <div className="space-y-2">
                  {categories.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between gap-2 rounded-2xl border border-border bg-card px-4 py-3"
                    >
                      <Link to={`/admin/torneos/${tournament.id}/cat/${c.id}`} className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{c.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {getPresetLabel((c as unknown as { preset_key?: string | null }).preset_key)} · {GENDER_LABEL[c.gender]} · cupo {c.max_participants}
                        </p>
                      </Link>
                      <Button size="sm" variant="outline" asChild>
                        <Link to={`/admin/torneos/${tournament.id}/cat/${c.id}`}>Gestionar</Link>
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => handleDeleteCategory(c.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </TabsContent>

          <TabsContent value="calendario" className="mt-4">
            {profile && (
              <TournamentCalendarPanel
                tournamentId={tournament.id}
                tenantId={profile.tenant_id}
              />
            )}
          </TabsContent>

          <TabsContent value="sesiones" className="mt-4">
            <SessionsTab tournamentId={tournament.id} />
          </TabsContent>

          <TabsContent value="operadores" className="mt-4">
            <OperatorsTab tournamentId={tournament.id} />
          </TabsContent>

          <TabsContent value="cobrand" className="mt-4">
            <CobrandTab tournamentId={tournament.id} tournamentName={tournament.name} />
          </TabsContent>

          <TabsContent value="reglamento" className="mt-4">
            <RulesTab tournamentId={tournament.id} />
          </TabsContent>

          <TabsContent value="config" className="mt-4 space-y-3">
            <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Cuadro por categoría
            </h3>
            {categories.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border bg-card/50 p-6 text-center text-sm text-muted-foreground">
                Aún no hay categorías.
              </p>
            ) : (
              <div className="space-y-2">
                {categories.map((c) => {
                  const frozen = !!c.bracket_generated_at;
                  const played = playedByCat.get(c.id) ?? 0;
                  return (
                    <div
                      key={c.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-card px-4 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{c.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {frozen ? (
                            <>
                              <Lock className="mr-1 inline h-3 w-3" /> Cuadro congelado · {played} partido(s) jugado(s)
                            </>
                          ) : (
                            "Inscripciones abiertas"
                          )}
                        </p>
                      </div>
                      {!frozen && (
                        <Button size="sm" variant="outline" asChild>
                          <Link to={`/admin/torneos/${tournament.id}/cat/${c.id}`}>
                            Cerrar y generar
                          </Link>
                        </Button>
                      )}
                      {frozen && played === 0 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleReopenCategory(c.id)}
                        >
                          <RotateCcw className="mr-1 h-3 w-3" /> Reabrir
                        </Button>
                      )}
                      {frozen && played > 0 && (
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          No reabrible
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="cierre" className="mt-4">
            <TournamentClosureTab
              tournamentId={tournament.id}
              tournamentSlug={tournament.slug ?? null}
              closedAt={(tournament as unknown as { closed_at: string | null }).closed_at ?? null}
              closingSummary={
                ((tournament as unknown as { closing_summary: ClosingSummary | null }).closing_summary) ?? null
              }
              onClosed={load}
            />
          </TabsContent>

          <TabsContent value="informe" className="mt-4">
            <TournamentReportTab tournamentId={tournament.id} />
          </TabsContent>

          <TabsContent value="captacion" className="mt-4">
            <MembershipOfferTab tournamentId={tournament.id} />
          </TabsContent>
        </Tabs>

        <section className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <Download className="h-4 w-4 text-primary" />
            <h3 className="font-display text-sm font-semibold">Exportar torneo</h3>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            Genera el reporte completo con bracket, ranking final, inscritos y resultados.
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={() => handleExport("pdf")}
              disabled={exporting !== null}
            >
              {exporting === "pdf" ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <FileText className="mr-1 h-4 w-4" />
              )}
              PDF
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={() => handleExport("xlsx")}
              disabled={exporting !== null}
            >
              {exporting === "xlsx" ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="mr-1 h-4 w-4" />
              )}
              Excel
            </Button>
          </div>
        </section>

        <p className="text-xs text-muted-foreground">
          Entra a cada categoría para gestionar inscripciones, generar la llave, programar partidos y
          cargar resultados.
        </p>
      </main>

      <CategoryWizard
        open={open}
        onOpenChange={setOpen}
        tournament={tournament}
        onSaved={load}
      />

      <TournamentFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        tournament={tournament}
        onSaved={() => {
          setEditOpen(false);
          load();
        }}
      />
    </div>
  );
};

export default AdminTorneoDetalle;
