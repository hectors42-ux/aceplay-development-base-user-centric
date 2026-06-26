import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, BarChart3, CalendarRange, Layers, Trophy, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/components/providers/AuthProvider";
import { AppShell } from "@/components/AppShell";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCategoryBundle } from "@/hooks/useCategoryData";
import { BracketView } from "@/components/tournaments/BracketView";
import { BracketTabs } from "@/components/tournaments/BracketTabs";
import { MatchList } from "@/components/tournaments/MatchList";
import { RegistrationList } from "@/components/tournaments/RegistrationList";
import { RoundRobinStandings } from "@/components/tournaments/RoundRobinStandings";
import { RoundRobinOpponents } from "@/components/tournaments/RoundRobinOpponents";
import { GroupsView } from "@/components/tournaments/GroupsView";
import { AmericanoRoundsView } from "@/components/tournaments/AmericanoRoundsView";
import { AmericanoIndividualStandings } from "@/components/tournaments/AmericanoIndividualStandings";
import { RegisterDialog } from "@/components/tournaments/RegisterDialog";
import { ResultDialog } from "@/components/tournaments/ResultDialog";
import { RescheduleDialog } from "@/components/tournaments/RescheduleDialog";
import { TournamentStats } from "@/components/tournaments/TournamentStats";
import { LiveIndicator } from "@/components/tournaments/LiveIndicator";
import { TournamentScheduleView } from "@/components/tournaments/TournamentScheduleView";
import {
  DISCIPLINE_LABEL,
  GENDER_LABEL,
  TOURNAMENT_STATUS_LABEL,
  tournamentStatusColor,
} from "@/lib/tournament-utils";
import type { Match } from "@/hooks/useCategoryData";
import { MyPathToggle } from "@/components/tournaments/bracket/MyPathToggle";
import { MatchSheet } from "@/components/tournaments/bracket/MatchSheet";
import { useMyPath } from "@/components/tournaments/bracket/useMyPath";

const TournamentCategoryDetail = () => {
  const { slug, catId } = useParams<{ slug: string; catId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  // Atrás determinístico: origen en state, si no el torneo padre.
  const backTo = (location.state as { from?: string } | null)?.from ?? `/torneos/${slug}`;
  // Set helper: preserva los demás params al cambiar uno de los tabs en la URL.
  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    next.set(key, value);
    setSearchParams(next);
  };
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
    lastUpdatedAt,
    refreshing,
    isLive,
  } = useCategoryBundle(catId);

  const [registerOpen, setRegisterOpen] = useState(false);
  const [resultMatch, setResultMatch] = useState<Match | null>(null);
  const [rescheduleMatch, setRescheduleMatch] = useState<Match | null>(null);
  const [sheetMatch, setSheetMatch] = useState<Match | null>(null);
  const [myPathActive, setMyPathActive] = useState(false);

  // ⚠️ Hooks DEBEN ir antes de cualquier early-return (React #310).
  // Calculamos "mi camino" sobre los matches del bracket activo. Si aún no hay
  // datos, useMyPath recibe arrays vacíos y devuelve un estado neutro.
  const isGroupsPlayoffPre = category?.motor === "grupos_playoff";
  const playoffMatchesPre = isGroupsPlayoffPre
    ? matches.filter((m) => (m as { phase?: string | null }).phase === "playoff")
    : matches;
  const { myPathMatchIds, stepsAhead, isOut, hasPath } = useMyPath(
    playoffMatchesPre,
    registrations,
    user?.id,
  );

  // Soporte para ?openResult=<matchId> (deep-link desde "Pendiente de tu parte" en perfil)
  useEffect(() => {
    const openId = searchParams.get("openResult");
    if (!openId || matches.length === 0) return;
    const m = matches.find((x) => x.id === openId);
    if (m) {
      setResultMatch(m);
      const next = new URLSearchParams(searchParams);
      next.delete("openResult");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, matches, setSearchParams]);

  if (loading) {
    return (
      <AppShell>
      <div className="min-h-screen bg-gradient-warm pb-28">
        <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-xl">
          <div className="mx-auto flex max-w-md items-center gap-3 px-5 py-4">
            <Skeleton className="h-9 w-9 rounded-2xl" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-5 w-40" />
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-md space-y-4 px-5 pt-4">
          <Skeleton className="h-10 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </main>
        <BottomNav />
      </div>
      </AppShell>
    );
  }

  if (!tournament || !category) {
    return (
      <AppShell>
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-gradient-warm">
        <p className="text-sm text-muted-foreground">Categoría no encontrada</p>
        <Link to={`/torneos/${slug}`} className="text-sm text-primary underline">
          Volver
        </Link>
      </div>
      </AppShell>
    );
  }

  const myReg = registrations.find(
    (r) =>
      (r.player1_user_id === user?.id || r.player2_user_id === user?.id) &&
      r.status !== "rechazada" &&
      r.status !== "retirada",
  );
  const myMatches = matches.filter((m) => {
    if (!user) return false;
    const inA = m.registration_a_id
      ? registrations.find((r) => r.id === m.registration_a_id)
      : undefined;
    const inB = m.registration_b_id
      ? registrations.find((r) => r.id === m.registration_b_id)
      : undefined;
    return [
      inA?.player1_user_id,
      inA?.player2_user_id,
      inB?.player1_user_id,
      inB?.player2_user_id,
    ].includes(user.id);
  });
  const canRegister =
    !myReg && tournament.status === "inscripciones_abiertas" && category.status !== "finalizado";
  const isRoundRobin = category.motor === "round_robin";
  const rrCanChallenge = isRoundRobin && (category as { scheduling?: string }).scheduling === "desafio_libre";
  const isGroupsPlayoff = category.motor === "grupos_playoff";
  const isAmericano = category.motor === "americano_rotacion";
  const isMultiBracket =
    category.motor === "consolacion" || category.motor === "doble_eliminacion";
  const groupMatches = matches.filter((m) => (m as { phase?: string | null }).phase === "grupos");
  const playoffMatches = matches.filter((m) => (m as { phase?: string | null }).phase === "playoff");
  const playoffGenerated = playoffMatches.length > 0;
  const userInitials = (() => {
    const p = user?.id ? players.get(user.id) : undefined;
    const f = p?.first_name?.[0] ?? "";
    const l = p?.last_name?.[0] ?? "";
    return (f + l).toUpperCase() || undefined;
  })();

  return (
    <AppShell>
    <div className="min-h-screen bg-gradient-warm pb-28">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-md items-center gap-3 px-5 py-4">
          <button
            type="button"
            onClick={() => navigate(backTo)}
            className="flex h-9 w-9 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground hover:text-foreground"
            aria-label="Volver"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
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
        <div className="mx-auto flex max-w-md flex-wrap items-center gap-2 px-5 pb-3 text-xs text-muted-foreground">
          {/* Solo meta con dato: evita los separadores huérfanos (". . cupo"). */}
          <span>
            {[
              DISCIPLINE_LABEL[category.discipline],
              GENDER_LABEL[category.gender],
              category.max_participants ? `cupo ${category.max_participants}` : null,
            ].filter(Boolean).join(" · ")}
          </span>
          {isLive && (
            <LiveIndicator
              lastUpdatedAt={lastUpdatedAt}
              refreshing={refreshing}
              className="ml-auto"
            />
          )}
        </div>
      </header>

      <main className="mx-auto max-w-md space-y-4 px-5 pt-4">
        {canRegister && (
          <Button className="w-full" onClick={() => setRegisterOpen(true)}>
            Inscribirme
          </Button>
        )}
        {myReg && (
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-3 text-sm">
            <p className="font-medium">Estás inscrito</p>
            <p className="text-xs text-muted-foreground">
              Estado: {TOURNAMENT_STATUS_LABEL[category.status as never] ?? myReg.status}
            </p>
          </div>
        )}

        <Tabs
          value={searchParams.get("tab") ?? (category.status === "finalizado" ? "stats" : myMatches.length > 0 ? "mine" : isRoundRobin ? "table" : "bracket")}
          onValueChange={(v) => setParam("tab", v)}
        >
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="mine" className="text-[10px]">
              <Trophy className="mr-1 h-3 w-3" /> Míos
            </TabsTrigger>
            {isRoundRobin ? (
              <TabsTrigger value="rivals" className="text-[10px]">
                <Users className="mr-1 h-3 w-3" /> Rivales
              </TabsTrigger>
            ) : (
              <TabsTrigger value="bracket" className="text-[10px]">
                <Layers className="mr-1 h-3 w-3" /> Llave
              </TabsTrigger>
            )}
            {isRoundRobin && (
              <TabsTrigger value="table" className="text-[10px]">
                <BarChart3 className="mr-1 h-3 w-3" /> Tabla
              </TabsTrigger>
            )}
            <TabsTrigger value="calendar" className="text-[10px]">
              <CalendarRange className="mr-1 h-3 w-3" /> Calendario
            </TabsTrigger>
            <TabsTrigger value="players" className="text-[10px]">
              <Users className="mr-1 h-3 w-3" /> Inscritos
            </TabsTrigger>
            {!isRoundRobin && (
              <TabsTrigger value="stats" className="text-[10px]">
                <BarChart3 className="mr-1 h-3 w-3" /> Stats
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="mine" className="mt-4">
            <MatchList
              matches={myMatches}
              registrations={registrations}
              players={players}
              courts={courts}
              pendingResults={pendingResults}
              pendingReschedules={pendingReschedules}
              isAdmin={isAdmin}
              rescheduleEnabled={tournament.reschedule_enabled}
              onSchedule={() => {}}
              onResult={setResultMatch}
              onReschedule={setRescheduleMatch}
              onChanged={reload}
              emptyText={myReg ? "Aún no tienes partidos asignados." : "Inscríbete para ver tus partidos."}
            />
          </TabsContent>

          {isAmericano ? (
            <TabsContent value="bracket" className="mt-4 space-y-3">
              <AmericanoRoundsView
                categoryId={category.id}
                matches={matches}
                players={players}
                isAdmin={false}
                highlightUserId={user?.id}
                category={category as never}
                onChanged={reload}
              />
              <div>
                <p className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                  Ranking individual
                </p>
                <AmericanoIndividualStandings
                  categoryId={category.id}
                  players={players}
                  highlightUserId={user?.id}
                />
              </div>
            </TabsContent>
          ) : isGroupsPlayoff ? (
            <TabsContent value="bracket" className="mt-4 space-y-3">
              <Tabs
                value={searchParams.get("phase") ?? (playoffGenerated ? "playoff" : "groups")}
                onValueChange={(v) => setParam("phase", v)}
                className="w-full"
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="groups" className="text-xs">Grupos</TabsTrigger>
                  <TabsTrigger value="playoff" className="text-xs">Playoff</TabsTrigger>
                </TabsList>
                <TabsContent value="groups" className="mt-3">
                  <GroupsView
                    category={category}
                    matches={groupMatches}
                    registrations={registrations}
                    players={players}
                    highlightUserId={user?.id}
                  />
                </TabsContent>
                <TabsContent value="playoff" className="mt-3">
                  {playoffGenerated ? (
                    <div className="space-y-3">
                      {hasPath && (
                        <MyPathToggle
                          active={myPathActive}
                          onToggle={setMyPathActive}
                          stepsAhead={stepsAhead}
                          isOut={isOut}
                          userInitials={userInitials}
                        />
                      )}
                      <BracketView
                        matches={playoffMatches}
                        registrations={registrations}
                        players={players}
                        courts={courts}
                        highlightUserId={user?.id}
                        onMatchClick={setSheetMatch}
                        myPathMatchIds={myPathMatchIds}
                        myPathActive={myPathActive}
                      />
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                      Aún no clasifican al playoff.
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </TabsContent>
          ) : isRoundRobin ? (
            <>
              <TabsContent value="rivals" className="mt-4">
                {rrCanChallenge && myReg ? (
                  <RoundRobinOpponents
                    categoryId={category.id}
                    tenantId={tournament.tenant_id}
                    onCreated={reload}
                  />
                ) : (
                  <p className="rounded-2xl border border-dashed border-border bg-muted/20 p-4 text-center text-xs text-muted-foreground">
                    {!myReg
                      ? "Inscríbete para ver tus rivales."
                      : "El agendamiento de esta categoría es por el organizador."}
                  </p>
                )}
              </TabsContent>
              <TabsContent value="table" className="mt-4">
                <RoundRobinStandings
                  category={category}
                  registrations={registrations}
                  players={players}
                  highlightUserId={user?.id}
                />
              </TabsContent>
            </>
          ) : isMultiBracket ? (
            <TabsContent value="bracket" className="mt-4 space-y-3">
              {hasPath && (
                <MyPathToggle
                  active={myPathActive}
                  onToggle={setMyPathActive}
                  stepsAhead={stepsAhead}
                  isOut={isOut}
                  userInitials={userInitials}
                />
              )}
              <BracketTabs
                motor={category.motor}
                matches={matches}
                registrations={registrations}
                players={players}
                courts={courts}
                highlightUserId={user?.id}
                onMatchClick={setSheetMatch}
                myPathMatchIds={myPathMatchIds}
                myPathActive={myPathActive}
              />
            </TabsContent>
          ) : (
            <TabsContent value="bracket" className="mt-4 space-y-3">
              {hasPath && (
                <MyPathToggle
                  active={myPathActive}
                  onToggle={setMyPathActive}
                  stepsAhead={stepsAhead}
                  isOut={isOut}
                  userInitials={userInitials}
                />
              )}
              <BracketView
                matches={matches}
                registrations={registrations}
                players={players}
                courts={courts}
                highlightUserId={user?.id}
                onMatchClick={setSheetMatch}
                myPathMatchIds={myPathMatchIds}
                myPathActive={myPathActive}
              />
            </TabsContent>
          )}

          <TabsContent value="calendar" className="mt-4">
            <TournamentScheduleView tournamentId={tournament.id} categoryId={category.id} />
          </TabsContent>

          <TabsContent value="players" className="mt-4">
            <RegistrationList
              registrations={registrations}
              players={players}
              bracketGenerated={!!category.bracket_generated_at}
              isAdmin={isAdmin}
              onChanged={reload}
            />
          </TabsContent>

          {!isRoundRobin && (
            <TabsContent value="stats" className="mt-4">
              <TournamentStats
                category={category}
                matches={matches}
                registrations={registrations}
                players={players}
              />
            </TabsContent>
          )}
        </Tabs>
      </main>

      <RegisterDialog
        open={registerOpen}
        onOpenChange={setRegisterOpen}
        category={category}
        onRegistered={reload}
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
      <RescheduleDialog
        open={!!rescheduleMatch}
        onOpenChange={(v) => !v && setRescheduleMatch(null)}
        match={rescheduleMatch}
        courts={courts}
        windowHours={tournament.reschedule_window_hours}
        minNoticeHours={tournament.reschedule_min_notice_hours}
        onRequested={reload}
      />
      <MatchSheet
        open={!!sheetMatch}
        onOpenChange={(v) => !v && setSheetMatch(null)}
        match={sheetMatch}
        matches={matches}
        registrations={registrations}
        players={players}
        courts={courts}
        userId={user?.id}
        onLoadResult={(m) => setResultMatch(m)}
      />

      <BottomNav />
    </div>
    </AppShell>
  );
};

export default TournamentCategoryDetail;
