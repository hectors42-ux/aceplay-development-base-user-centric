import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Radio } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import { useOperatorBoard, type OperatorPlayer } from "@/hooks/useOperatorBoard";
import { useMyOperatorTournaments } from "@/hooks/useMyOperatorTournaments";
import { CourtLiveCard } from "@/components/tournaments/operator/CourtLiveCard";
import { RoundProgressCard } from "@/components/tournaments/operator/RoundProgressCard";
import { CloseRoundButton } from "@/components/tournaments/operator/CloseRoundButton";
import { AmericanoResultDialog } from "@/components/tournaments/AmericanoResultDialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { haptic } from "@/lib/feedback/haptic";
import type { Tables } from "@/integrations/supabase/types";

type Match = Tables<"tournament_matches">;

const OperatorLiveBoard = () => {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const { tournaments: myOperatorTournaments, loading: opLoading } = useMyOperatorTournaments();
  const board = useOperatorBoard(slug);
  const [activeCatId, setActiveCatId] = useState<string | null>(null);
  const [resultMatch, setResultMatch] = useState<Match | null>(null);
  const [startingMatchId, setStartingMatchId] = useState<string | null>(null);

  const isAuthorized = useMemo(() => {
    if (!board.tournament || !user) return null;
    if (opLoading) return null;
    return myOperatorTournaments.some((t) => t.id === board.tournament?.id);
  }, [board.tournament, user, opLoading, myOperatorTournaments]);

  useEffect(() => {
    if (board.rounds.length > 0 && !activeCatId) {
      setActiveCatId(board.rounds[0].category.id);
    }
  }, [board.rounds, activeCatId]);

  if (board.loading || opLoading || isAuthorized === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!board.tournament) {
    return <Navigate to="/404" replace />;
  }

  if (!isAuthorized) {
    return <Navigate to="/404" replace />;
  }

  // Group rounds by category, pick the most recent round per category for the LIVE view
  const roundsByCategory = new Map<string, typeof board.rounds[number]>();
  board.rounds.forEach((r) => {
    if (!roundsByCategory.has(r.category.id)) {
      roundsByCategory.set(r.category.id, r);
    }
  });
  const availableCats = Array.from(roundsByCategory.values()).map((r) => r.category);
  const currentView = activeCatId ? roundsByCategory.get(activeCatId) ?? null : null;

  const handleStart = async (match: Match) => {
    setStartingMatchId(match.id);
    try {
      const { error } = await supabase
        .from("tournament_matches")
        .update({ status: "programado", scheduled_at: new Date().toISOString() })
        .eq("id", match.id);
      if (error) throw error;
      haptic("medium");
      toast({ title: "Partido iniciado", description: "La cancha pasó a En juego." });
      await board.reload();
    } catch (err) {
      toast({
        title: "No se pudo iniciar",
        description: err instanceof Error ? err.message : "Inténtalo nuevamente",
        variant: "destructive",
      });
    } finally {
      setStartingMatchId(null);
    }
  };

  // Build players map for AmericanoResultDialog (expects Player shape)
  const playersMap = new Map(
    Array.from(board.players.entries()).map(([id, p]: [string, OperatorPlayer]) => [
      id,
      {
        user_id: id,
        first_name: p.first_name,
        last_name: p.last_name,
        ntrp_level: null,
        club_ranking: null,
      },
    ]),
  );

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-md items-center gap-3 px-5 py-3">
          <Link
            to={`/torneos/${slug}`}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border hover:bg-muted"
            aria-label="Volver al torneo"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-muted-foreground">
              Modo operador
            </p>
            <h1 className="truncate font-display text-lg font-semibold">
              {board.tournament.name}
            </h1>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.18em] text-destructive">
            <Radio className="h-2.5 w-2.5 motion-safe:animate-pulse" />
            Live
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-md space-y-4 px-5 pt-4">
        {availableCats.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-8 text-center text-sm text-muted-foreground">
            No hay rondas activas en este momento.
          </div>
        ) : (
          <>
            {availableCats.length > 1 && (
              <div className="flex flex-wrap gap-2">
                {availableCats.map((c) => (
                  <Button
                    key={c.id}
                    size="sm"
                    variant={c.id === activeCatId ? "default" : "outline"}
                    onClick={() => setActiveCatId(c.id)}
                  >
                    {c.name}
                  </Button>
                ))}
              </div>
            )}

            {currentView && (
              <>
                <RoundProgressCard
                  roundLabel={`Ronda ${currentView.round.round_number} · Canchas`}
                  categoryName={currentView.category.name}
                  closed={currentView.closedMatches}
                  total={currentView.totalMatches}
                  roundStartedAt={currentView.round.created_at}
                  avgMatchMinutes={25}
                />

                <div className="space-y-3">
                  {currentView.courts.map((view) => {
                    const isMine = user
                      ? view.sideA.some((p) => p.user_id === user.id) ||
                        view.sideB.some((p) => p.user_id === user.id)
                      : false;
                    return (
                      <CourtLiveCard
                        key={view.match.id}
                        view={view}
                        isMyMatch={isMine}
                        onStart={() => handleStart(view.match)}
                        onLoadResult={() => setResultMatch(view.match)}
                        pending={startingMatchId === view.match.id}
                        streamEnabled={Boolean((board.tournament as unknown as { is_public_stream_enabled?: boolean })?.is_public_stream_enabled)}
                        tournamentId={board.tournament?.id ?? null}
                      />
                    );
                  })}
                </div>

                <CloseRoundButton
                  categoryId={currentView.category.id}
                  currentRound={currentView.round.round_number}
                  targetRounds={
                    (currentView.category as unknown as { americano_rounds_target: number | null })
                      .americano_rounds_target
                  }
                  allClosed={currentView.allClosed}
                  onDone={() => board.reload()}
                />
              </>
            )}
          </>
        )}
      </main>

      <AmericanoResultDialog
        open={!!resultMatch}
        onOpenChange={(v) => !v && setResultMatch(null)}
        match={resultMatch}
        players={playersMap as unknown as Map<string, { user_id: string; first_name: string; last_name: string; ntrp_level: number | null; club_ranking: number | null }>}
        category={currentView?.category ?? null}
        onSubmitted={() => {
          setResultMatch(null);
          void board.reload();
        }}
      />
    </div>
  );
};

export default OperatorLiveBoard;