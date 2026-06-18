import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useCategoryBundle } from "@/hooks/useCategoryData";
import { useAmericanoRounds, type AmericanoRound } from "@/hooks/useAmericanoRounds";
import { useTournamentSessions } from "@/hooks/useTournamentSessions";
import { TournamentSummaryCard } from "@/components/tournaments/admin/TournamentSummaryCard";
import { PairsRoundEditor } from "@/components/tournaments/admin/PairsRoundEditor";

const AdminCategoryPairs = () => {
  const { id: tournamentId, catId } = useParams<{ id: string; catId: string }>();
  const navigate = useNavigate();
  const { tournament, category, registrations, courts, loading } = useCategoryBundle(catId);
  const { rounds, loading: loadingRounds, reload: reloadRounds } = useAmericanoRounds(catId);
  const { sessions } = useTournamentSessions(tournamentId);

  const [currentRoundId, setCurrentRoundId] = useState<string | undefined>(undefined);
  const [resorting, setResorting] = useState(false);

  useEffect(() => {
    if (!currentRoundId && rounds.length > 0) {
      // primera no finalizada o la última
      const target = rounds.find((r) => r.status !== "finalizada") ?? rounds[rounds.length - 1];
      setCurrentRoundId(target.id);
    }
  }, [rounds, currentRoundId]);

  const round = useMemo(() => rounds.find((r) => r.id === currentRoundId) ?? null, [rounds, currentRoundId]);

  const confirmedCount = registrations.filter((r) => r.status === "confirmada").length;
  const tournamentCourts = courts;

  const handleResort = async () => {
    if (!catId || !round) return;
    setResorting(true);
    const fromRound = rounds.find((r) => r.status !== "finalizada")?.round_number ?? round.round_number;
    const { error } = await (supabase.rpc as unknown as (
      fn: string,
      params: Record<string, unknown>,
    ) => Promise<{ error: { message: string } | null }>)("regenerate_americano_rounds", {
      _category_id: catId,
      _from_round: fromRound,
    });
    setResorting(false);
    if (error) {
      toast({ title: "No se pudo re-sortear", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Rondas regeneradas" });
    await reloadRounds();
  };

  if (loading || loadingRounds) {
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

  if (category.motor !== "americano_rotacion") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-gradient-warm p-4 text-center">
        <p className="text-sm text-muted-foreground">
          El editor de parejas sólo aplica al motor Americano.
        </p>
        <Link to={`/admin/torneos/${tournamentId}/cat/${catId}`} className="text-sm text-primary underline">
          Volver
        </Link>
      </div>
    );
  }

  const currentSession = useMemo(() => {
    if (!round) return null;
    if (round.tournament_session_id) {
      const found = sessions.find((s) => s.id === round.tournament_session_id);
      if (found) return found;
    }
    return sessions.length === 1 ? sessions[0] : null;
  }, [round, sessions]);

  return (
    <main className="min-h-screen bg-gradient-warm pb-24">
      <div className="mx-auto w-full max-w-md space-y-4 p-4 md:max-w-2xl">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/admin/torneos/${tournamentId}/cat/${catId}`)} aria-label="Volver">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-muted-foreground">
              Admin · {category.name}
            </p>
            <h1 className="font-serif text-xl">Sorteo & parejas</h1>
          </div>
        </div>

        <TournamentSummaryCard
          status={rounds.length > 0 ? "generado" : "pendiente"}
          lastGeneratedAt={rounds[0] ? (rounds[0] as unknown as { created_at?: string }).created_at ?? null : null}
          stats={[
            { value: confirmedCount, label: "jugadores" },
            { value: tournamentCourts.length, label: "canchas" },
            { value: rounds.length, label: "rondas" },
            { value: sessions.length, label: "sesiones" },
          ]}
          onResort={rounds.length > 0 ? handleResort : undefined}
          resorting={resorting}
        />

        {round ? (
          <PairsRoundEditor
            round={round}
            rounds={rounds}
            categoryId={catId!}
            tournamentId={tournamentId!}
            courts={tournamentCourts}
            currentSession={currentSession}
            onChangeRound={(r: AmericanoRound) => setCurrentRoundId(r.id)}
            onSaved={() => reloadRounds()}
          />
        ) : (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Aún no hay rondas generadas para esta categoría.
          </p>
        )}
      </div>
    </main>
  );
};

export default AdminCategoryPairs;