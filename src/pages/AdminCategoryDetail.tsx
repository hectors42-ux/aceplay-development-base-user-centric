import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Layers, Trophy, Users, CalendarClock, CheckCircle2, RotateCcw, UserPlus, ArrowLeftRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCategoryBundle } from "@/hooks/useCategoryData";
import { BracketView } from "@/components/tournaments/BracketView";
import { BracketTabs } from "@/components/tournaments/BracketTabs";
import { MatchList } from "@/components/tournaments/MatchList";
import { RegistrationList } from "@/components/tournaments/RegistrationList";
import { RoundRobinStandings } from "@/components/tournaments/RoundRobinStandings";
import { GroupsView } from "@/components/tournaments/GroupsView";
import { GenerateGroupsDialog } from "@/components/tournaments/GenerateGroupsDialog";
import { AmericanoRoundsView } from "@/components/tournaments/AmericanoRoundsView";
import { AmericanoIndividualStandings } from "@/components/tournaments/AmericanoIndividualStandings";
import { FinanceTab } from "@/components/tournaments/FinanceTab";
import { ResultDialog } from "@/components/tournaments/ResultDialog";
import { ScheduleDialog } from "@/components/tournaments/ScheduleDialog";
import { SeedingDialog } from "@/components/tournaments/SeedingDialog";
import { CategoryCloseDialog } from "@/components/tournaments/CategoryCloseDialog";
import { AdminRegisterPlayerDialog } from "@/components/tournaments/AdminRegisterPlayerDialog";
import { CorrectResultDialog } from "@/components/tournaments/CorrectResultDialog";
import { toast } from "@/hooks/use-toast";
import {
  DISCIPLINE_LABEL,
  GENDER_LABEL,
  TOURNAMENT_STATUS_LABEL,
  tournamentStatusColor,
} from "@/lib/tournament-utils";
import type { Match } from "@/hooks/useCategoryData";

const AdminCategoryDetail = () => {
  const { id: tournamentId, catId } = useParams<{ id: string; catId: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const {
    tournament,
    category,
    registrations,
    matches,
    players,
    pendingResults,
    pendingReschedules,
    courts,
    loading,
    reload,
  } = useCategoryBundle(catId);

  const [seedingOpen, setSeedingOpen] = useState(false);
  const [groupsOpen, setGroupsOpen] = useState(false);
  const [advanceLoading, setAdvanceLoading] = useState(false);
  const [scheduleMatch, setScheduleMatch] = useState<Match | null>(null);
  const [resultMatch, setResultMatch] = useState<Match | null>(null);
  const [correctMatch, setCorrectMatch] = useState<Match | null>(null);
  const [closeOpen, setCloseOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [reopenLoading, setReopenLoading] = useState(false);
  const [deadlineLoading, setDeadlineLoading] = useState(false);

  const handleReopen = async () => {
    if (!category) return;
    setReopenLoading(true);
    const { error } = await supabase
      .from("tournament_categories")
      .update({ status: "en_curso" })
      .eq("id", category.id);
    setReopenLoading(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Categoría reabierta" });
    reload();
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-warm">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!tournament || !category) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-gradient-warm">
        <p className="text-sm text-muted-foreground">Categoría no encontrada</p>
        <Link to={`/admin/torneos/${tournamentId}`} className="text-sm text-primary underline">
          Volver
        </Link>
      </div>
    );
  }

  const confirmedCount = registrations.filter((r) => r.status === "confirmada").length;
  const bracketGenerated = !!category.bracket_generated_at;
  const isRoundRobin = category.motor === "round_robin";
  const isGroupsPlayoff = category.motor === "grupos_playoff";
  const isAmericano = category.motor === "americano_rotacion";
  const isMultiBracket =
    category.motor === "consolacion" || category.motor === "doble_eliminacion";
  const groupMatches = matches.filter((m) => (m as { phase?: string | null }).phase === "grupos");
  const playoffMatches = matches.filter((m) => (m as { phase?: string | null }).phase === "playoff");
  const pendingGroupMatches = groupMatches.filter(
    (m) => m.status !== "jugado" && m.status !== "walkover",
  ).length;
  const playoffGenerated = playoffMatches.length > 0;
  const groupsTab = "groups";
  const entryFee = (category as { entry_fee_clp?: number | null }).entry_fee_clp ?? 0;
  const closeMode = (category as { close_mode?: string | null }).close_mode ?? "bracket";
  const deadlineAt = (category as { deadline_at?: string | null }).deadline_at;
  const canCloseDeadline =
    closeMode === "deadline" &&
    !!deadlineAt &&
    new Date(deadlineAt).getTime() <= Date.now() &&
    category.status !== "finalizado";

  const handleGenerateRoundRobin = async () => {
    if (!category) return;
    const ok = window.confirm(
      `Esto congela el roster con ${confirmedCount} inscritos y genera ${
        (confirmedCount * (confirmedCount - 1)) / 2
      } partidos. ¿Continuar?`,
    );
    if (!ok) return;
    const { data, error } = await supabase.rpc("generate_round_robin" as never, {
      _category_id: category.id,
    } as never);
    if (error) {
      toast({ title: "No se pudo generar el fixture", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Fixture generado", description: `${data} partidos creados.` });
    reload();
  };

  const handleAdvanceToPlayoff = async () => {
    if (!category) return;
    const ok = window.confirm(
      `Se clasificarán los mejores ${category.qualifiers_per_group ?? 2} por grupo al bracket. ¿Continuar?`,
    );
    if (!ok) return;
    setAdvanceLoading(true);
    const { data, error } = await supabase.rpc("advance_groups_to_playoff" as never, {
      _category_id: category.id,
    } as never);
    setAdvanceLoading(false);
    if (error) {
      toast({ title: "No se pudo avanzar", description: error.message, variant: "destructive" });
      return;
    }
    const info = (data as { bracket_size?: number } | null)?.bracket_size ?? 0;
    toast({ title: "Playoff generado", description: `Bracket de ${info} clasificados.` });
    reload();
  };

  const handleCloseDeadline = async () => {
    if (!category) return;
    const ok = window.confirm(
      "Esto cancela todos los partidos no jugados y finaliza la categoría. ¿Continuar?",
    );
    if (!ok) return;
    setDeadlineLoading(true);
    const { error } = await supabase.rpc("close_by_deadline" as never, {
      _category_id: category.id,
    } as never);
    setDeadlineLoading(false);
    if (error) {
      toast({ title: "No se pudo cerrar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Categoría cerrada por deadline" });
    reload();
  };

  return (
    <div className="min-h-screen bg-gradient-warm pb-12">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-5 py-4">
          <Link
            to={`/admin/torneos/${tournamentId}`}
            className="flex h-9 w-9 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground hover:text-foreground"
            aria-label="Volver"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-muted-foreground">{tournament.name}</p>
            <h1 className="truncate font-display text-lg font-semibold">{category.name}</h1>
          </div>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${tournamentStatusColor(category.status)}`}
          >
            {TOURNAMENT_STATUS_LABEL[category.status]}
          </span>
        </div>
        <div className="mx-auto flex max-w-3xl gap-3 px-5 pb-3 text-xs text-muted-foreground">
          <span>{DISCIPLINE_LABEL[category.discipline]}</span>
          <span>·</span>
          <span>{GENDER_LABEL[category.gender]}</span>
          <span>·</span>
          <span>cupo {category.max_participants}</span>
          <span>·</span>
          <span>{confirmedCount} confirmados</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-5 pt-4">
        <section className="rounded-2xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Estado de la categoría
              </p>
              <p className="font-display text-sm font-semibold">
                {TOURNAMENT_STATUS_LABEL[category.status]}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {category.status !== "finalizado" && (
                <Button size="sm" onClick={() => setCloseOpen(true)}>
                  <CheckCircle2 className="mr-1 h-4 w-4" /> Finalizar
                </Button>
              )}
              {canCloseDeadline && (
                <Button size="sm" variant="secondary" onClick={handleCloseDeadline} disabled={deadlineLoading}>
                  {deadlineLoading && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                  Cerrar por deadline
                </Button>
              )}
              {category.status === "finalizado" && (
                <Button size="sm" variant="outline" onClick={handleReopen} disabled={reopenLoading}>
                  {reopenLoading ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  ) : (
                    <RotateCcw className="mr-1 h-4 w-4" />
                  )}
                  Reabrir
                </Button>
              )}
            </div>
          </div>
        </section>

        <Tabs defaultValue="registrations">
          <TabsList className={`grid w-full ${entryFee > 0 ? "grid-cols-5" : "grid-cols-4"}`}>
            <TabsTrigger value="registrations" className="text-xs">
              <Users className="mr-1 h-3 w-3" /> Inscritos
            </TabsTrigger>
            <TabsTrigger value="bracket" className="text-xs">
              <Trophy className="mr-1 h-3 w-3" /> Llave
            </TabsTrigger>
            <TabsTrigger value="schedule" className="text-xs">
              <CalendarClock className="mr-1 h-3 w-3" /> Programar
            </TabsTrigger>
            <TabsTrigger value="results" className="text-xs">
              <Layers className="mr-1 h-3 w-3" /> Partidos
            </TabsTrigger>
            {entryFee > 0 && (
              <TabsTrigger value="finance" className="text-xs">
                $ Finanzas
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="registrations" className="mt-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                Total: {registrations.length} · Confirmados: {confirmedCount}
              </p>
              {!bracketGenerated && category.status !== "finalizado" && (
                <Button size="sm" variant="outline" onClick={() => setRegisterOpen(true)}>
                  <UserPlus className="mr-1 h-4 w-4" /> Inscribir socio
                </Button>
              )}
            </div>
            <RegistrationList
              registrations={registrations}
              players={players}
              bracketGenerated={bracketGenerated}
              isAdmin
              onChanged={reload}
            />
          </TabsContent>

          <TabsContent value="bracket" className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {isGroupsPlayoff
                  ? bracketGenerated
                    ? `Grupos generados · ${groupMatches.length} partidos · Playoff: ${playoffGenerated ? `${playoffMatches.length} partidos` : "pendiente"}`
                    : `Grupos pendientes · ${confirmedCount} inscritos confirmados`
                  : isRoundRobin
                  ? bracketGenerated
                    ? `Round robin generado · ${matches.length} partidos`
                    : `Round robin pendiente · ${confirmedCount} inscritos confirmados`
                  : bracketGenerated
                    ? `Llave generada (${matches.length} partidos)`
                    : `Llave pendiente · ${confirmedCount} inscripciones confirmadas`}
              </p>
              {!bracketGenerated && !isRoundRobin && !isGroupsPlayoff && !isAmericano && (
                <Button size="sm" onClick={() => setSeedingOpen(true)} disabled={confirmedCount < 2}>
                  Generar llave
                </Button>
              )}
              {!bracketGenerated && isRoundRobin && (
                <Button size="sm" onClick={handleGenerateRoundRobin} disabled={confirmedCount < 3}>
                  Congelar roster y generar fixture
                </Button>
              )}
              {!bracketGenerated && isGroupsPlayoff && (
                <Button size="sm" onClick={() => setGroupsOpen(true)} disabled={confirmedCount < 4}>
                  Generar grupos
                </Button>
              )}
              {isGroupsPlayoff && bracketGenerated && !playoffGenerated && (
                <Button
                  size="sm"
                  onClick={handleAdvanceToPlayoff}
                  disabled={advanceLoading || pendingGroupMatches > 0}
                >
                  {advanceLoading && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                  Avanzar a playoff
                  {pendingGroupMatches > 0 && (
                    <span className="ml-1 text-[10px] opacity-70">({pendingGroupMatches} pend.)</span>
                  )}
                </Button>
              )}
            </div>
            {isAmericano ? (
              <div className="space-y-4">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => navigate(`/admin/torneos/${tournamentId}/cat/${catId}/parejas`)}
                >
                  <ArrowLeftRight className="mr-1.5 h-4 w-4" />
                  Abrir editor de parejas
                </Button>
                <AmericanoRoundsView
                  categoryId={category.id}
                  matches={matches}
                  players={players}
                  isAdmin
                  category={category as never}
                  onChanged={reload}
                />
                <div>
                  <p className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                    Ranking individual
                  </p>
                  <AmericanoIndividualStandings categoryId={category.id} players={players} />
                </div>
              </div>
            ) : isGroupsPlayoff ? (
              <Tabs defaultValue={playoffGenerated ? "playoff" : groupsTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value={groupsTab} className="text-xs">Grupos</TabsTrigger>
                  <TabsTrigger value="playoff" className="text-xs">Playoff</TabsTrigger>
                </TabsList>
                <TabsContent value={groupsTab} className="mt-3">
                  <GroupsView
                    category={category}
                    matches={groupMatches}
                    registrations={registrations}
                    players={players}
                  />
                </TabsContent>
                <TabsContent value="playoff" className="mt-3">
                  {playoffGenerated ? (
                    <BracketView
                      matches={playoffMatches}
                      registrations={registrations}
                      players={players}
                      courts={courts}
                      onMatchClick={(m) => navigate(`?match=${m.id}`)}
                    />
                  ) : (
                    <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                      Aún no se clasifican los grupos al playoff.
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            ) : isRoundRobin ? (
              <RoundRobinStandings
                category={category}
                registrations={registrations}
                players={players}
              />
            ) : isMultiBracket ? (
              <BracketTabs
                motor={category.motor}
                matches={matches}
                registrations={registrations}
                players={players}
                courts={courts}
                onMatchClick={(m) => navigate(`?match=${m.id}`)}
              />
            ) : (
              <BracketView
                matches={matches}
                registrations={registrations}
                players={players}
                courts={courts}
                onMatchClick={(m) => navigate(`?match=${m.id}`)}
              />
            )}
          </TabsContent>

          <TabsContent value="schedule" className="mt-4 space-y-3">
            <p className="text-xs text-muted-foreground">
              Asigna cancha y horario. Se crea una reserva automática que bloquea la cancha.
            </p>
            <MatchList
              matches={matches.filter(
                (m) =>
                  m.registration_a_id &&
                  m.registration_b_id &&
                  m.status !== "jugado" &&
                  m.status !== "walkover" &&
                  m.status !== "cancelado",
              )}
              registrations={registrations}
              players={players}
              courts={courts}
              pendingResults={pendingResults}
              pendingReschedules={pendingReschedules}
              isAdmin
              rescheduleEnabled={tournament.reschedule_enabled}
              onSchedule={setScheduleMatch}
              onResult={setResultMatch}
              onReschedule={setScheduleMatch}
              onChanged={reload}
              emptyText="No hay partidos listos para programar."
            />
          </TabsContent>

          <TabsContent value="results" className="mt-4 space-y-3">
            <MatchList
              matches={matches}
              registrations={registrations}
              players={players}
              courts={courts}
              pendingResults={pendingResults}
              pendingReschedules={pendingReschedules}
              isAdmin
              rescheduleEnabled={tournament.reschedule_enabled}
              onSchedule={setScheduleMatch}
              onResult={setResultMatch}
              onReschedule={setScheduleMatch}
              onCorrect={setCorrectMatch}
              onChanged={reload}
              emptyText="Aún no hay partidos. Genera la llave primero."
            />
          </TabsContent>

          {entryFee > 0 && (
            <TabsContent value="finance" className="mt-4 space-y-3">
              <FinanceTab
                categoryId={category.id}
                registrations={registrations}
                players={players}
                onChanged={reload}
              />
            </TabsContent>
          )}
        </Tabs>
      </main>

      <SeedingDialog
        open={seedingOpen}
        onOpenChange={setSeedingOpen}
        categoryId={category.id}
        registrations={registrations}
        players={players}
        onGenerated={reload}
        motor={category.motor}
      />
      <GenerateGroupsDialog
        open={groupsOpen}
        onOpenChange={setGroupsOpen}
        categoryId={category.id}
        confirmedCount={confirmedCount}
        onGenerated={reload}
      />
      <ScheduleDialog
        open={!!scheduleMatch}
        onOpenChange={(v) => !v && setScheduleMatch(null)}
        match={scheduleMatch}
        courts={courts}
        onScheduled={reload}
        mode={isAdmin ? "schedule" : "schedule"}
      />
      <ResultDialog
        open={!!resultMatch}
        onOpenChange={(v) => !v && setResultMatch(null)}
        match={resultMatch}
        registrations={registrations}
        players={players}
        onSubmitted={reload}
        category={category}
      />
      <CategoryCloseDialog
        open={closeOpen}
        onOpenChange={setCloseOpen}
        categoryId={category.id}
        matches={matches}
        registrations={registrations}
        players={players}
        onClosed={reload}
      />
      <AdminRegisterPlayerDialog
        open={registerOpen}
        onOpenChange={setRegisterOpen}
        category={category}
        registrations={registrations}
        onRegistered={reload}
      />
      <CorrectResultDialog
        open={!!correctMatch}
        onOpenChange={(v) => !v && setCorrectMatch(null)}
        match={correctMatch}
        allMatches={matches}
        registrations={registrations}
        players={players}
        onCorrected={reload}
      />
    </div>
  );
};

export default AdminCategoryDetail;
