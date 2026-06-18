import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, X, Loader2, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { haptic } from "@/lib/feedback/haptic";
import { BottomNav } from "@/components/BottomNav";

interface PlayerInfo { id: string; name: string }
interface MatchRow {
  id: string;
  side_a_user_ids: string[] | null;
  side_b_user_ids: string[] | null;
  winner_side: string | null;
  score: unknown;
  confirmation_status: string | null;
  reported_by: string | null;
  reported_at: string | null;
  category: {
    label: string | null;
    tournament: { name: string | null; slug: string | null } | null;
  } | null;
}

function formatScore(score: unknown): string | null {
  if (!score || typeof score !== "object") return null;
  const sets = score as Array<{ a?: number; b?: number }>;
  if (!Array.isArray(sets) || sets.length === 0) return null;
  return sets.map((s) => `${s.a ?? 0}-${s.b ?? 0}`).join(" · ");
}

export default function ResultadoPendiente() {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [match, setMatch] = useState<MatchRow | null>(null);
  const [players, setPlayers] = useState<Map<string, PlayerInfo>>(new Map());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");

  useEffect(() => {
    if (!matchId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("tournament_matches")
        .select(
          "id, side_a_user_ids, side_b_user_ids, winner_side, score, confirmation_status, reported_by, reported_at, category:tournament_categories(label, tournament:tournaments(name, slug))",
        )
        .eq("id", matchId)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        toast({ title: "Partido no encontrado", variant: "destructive" });
        navigate(-1);
        return;
      }
      const m = data as unknown as MatchRow;
      setMatch(m);
      const ids = [...(m.side_a_user_ids ?? []), ...(m.side_b_user_ids ?? []), m.reported_by].filter(
        (x): x is string => !!x,
      );
      if (ids.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, first_name, last_name")
          .in("user_id", ids);
        const map = new Map<string, PlayerInfo>();
        (profs ?? []).forEach((p) => {
          map.set(p.user_id, {
            id: p.user_id,
            name: `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || "Jugador",
          });
        });
        setPlayers(map);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [matchId, navigate]);

  if (loading || !match) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const score = formatScore(match.score);
  const sideA = (match.side_a_user_ids ?? []).map((id) => players.get(id)?.name ?? "Jugador");
  const sideB = (match.side_b_user_ids ?? []).map((id) => players.get(id)?.name ?? "Jugador");
  const reporterName = match.reported_by ? players.get(match.reported_by)?.name ?? "Operador" : "Operador";
  const winnerLabel = match.winner_side === "a" ? sideA.join(" / ") : sideB.join(" / ");
  const isPlayer = user
    ? (match.side_a_user_ids ?? []).includes(user.id) || (match.side_b_user_ids ?? []).includes(user.id)
    : false;
  const isReporter = user ? match.reported_by === user.id : false;
  const status = match.confirmation_status ?? "pendiente_confirmacion";
  const userSide: "a" | "b" | null = user
    ? (match.side_a_user_ids ?? []).includes(user.id)
      ? "a"
      : (match.side_b_user_ids ?? []).includes(user.id)
        ? "b"
        : null
    : null;
  const userWon = userSide !== null && match.winner_side === userSide;
  const slug = match.category?.tournament?.slug ?? null;

  const handleConfirm = async () => {
    if (!matchId) return;
    setSubmitting(true);
    haptic("medium");
    const { error } = await supabase.rpc("player_confirm_result", { _match_id: matchId });
    setSubmitting(false);
    if (error) {
      toast({ title: "No se pudo confirmar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Resultado confirmado", description: "¡Gracias por tu confirmación!" });
    if (userWon && slug) {
      toast({
        title: "¡Sumaste!",
        description: "Compartí tu victoria con el club.",
        action: (
          <button
            type="button"
            onClick={() => navigate(`/torneos/${slug}/compartir?kind=moment`)}
            className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground"
          >
            Compartir →
          </button>
        ),
      });
    }
    navigate(-1);
  };

  const handleDispute = async () => {
    if (!matchId) return;
    setSubmitting(true);
    haptic("heavy");
    const { error } = await supabase.rpc("player_dispute_result", {
      _match_id: matchId,
      _reason: disputeReason,
    });
    setSubmitting(false);
    setDisputeOpen(false);
    if (error) {
      toast({ title: "No se pudo disputar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Resultado disputado", description: "El organizador revisará el caso." });
    navigate(-1);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/95 px-5 py-3 backdrop-blur">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Volver
        </button>
      </header>

      <main className="mx-auto max-w-md space-y-4 px-5 pb-32 pt-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-primary">
            Confirmar resultado
          </p>
          <h1 className="mt-1 font-display text-2xl font-semibold leading-tight">
            {match.category?.tournament?.name ?? "Torneo"}
          </h1>
          <p className="text-sm text-muted-foreground">{match.category?.label ?? ""}</p>
        </div>

        <article className="rounded-2xl border-2 border-primary/40 bg-card p-4">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Cargado por <span className="font-semibold text-foreground">{reporterName}</span>
          </p>

          <div className="mt-3 space-y-2">
            <div className={`rounded-lg border p-3 ${match.winner_side === "a" ? "border-primary bg-primary/5" : ""}`}>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Pareja A</p>
              <p className="font-semibold">{sideA.join(" · ") || "—"}</p>
            </div>
            <div className={`rounded-lg border p-3 ${match.winner_side === "b" ? "border-primary bg-primary/5" : ""}`}>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Pareja B</p>
              <p className="font-semibold">{sideB.join(" · ") || "—"}</p>
            </div>
          </div>

          {score && (
            <div className="mt-3 rounded-lg bg-muted/40 p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Score</p>
              <p className="font-mono text-lg font-semibold">{score}</p>
            </div>
          )}

          <div className="mt-3 rounded-lg bg-primary/10 p-3">
            <p className="text-[10px] uppercase tracking-wider text-primary">Ganador</p>
            <p className="font-display text-lg font-semibold text-primary">{winnerLabel}</p>
          </div>
        </article>

        {status !== "pendiente_confirmacion" ? (
          <div className="rounded-xl border bg-muted/30 p-4 text-center text-sm text-muted-foreground">
            Este resultado ya está <strong>{status}</strong>.
          </div>
        ) : !isPlayer ? (
          <div className="rounded-xl border bg-muted/30 p-4 text-center text-sm text-muted-foreground">
            Solo los jugadores del partido pueden confirmar o disputar el resultado.
          </div>
        ) : isReporter ? (
          <div className="rounded-xl border bg-muted/30 p-4 text-center text-sm text-muted-foreground">
            Cargaste este resultado, espera la confirmación del otro lado.
          </div>
        ) : (
          <div className="space-y-2">
            <Button
              size="lg"
              className="w-full"
              onClick={handleConfirm}
              disabled={submitting}
            >
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
              Sí, confirmar resultado
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="w-full border-destructive/40 text-destructive hover:bg-destructive/10"
              onClick={() => setDisputeOpen(true)}
              disabled={submitting}
            >
              <X className="mr-2 h-4 w-4" /> No coincide, disputar
            </Button>
            <p className="pt-1 text-center text-[11px] text-muted-foreground">
              Si no haces nada, se confirmará automáticamente.
            </p>
          </div>
        )}
      </main>

      <AlertDialog open={disputeOpen} onOpenChange={setDisputeOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" />
              Disputar resultado
            </AlertDialogTitle>
            <AlertDialogDescription>
              Contanos qué no coincide. El organizador revisará el partido y resolverá la disputa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            value={disputeReason}
            onChange={(e) => setDisputeReason(e.target.value)}
            placeholder="Ej: el score correcto fue 6-4, 6-3"
            rows={3}
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDispute}
              disabled={submitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Disputar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BottomNav />
    </div>
  );
}