import { useEffect, useState } from "react";
import { Sparkles, ShieldCheck, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import { Button } from "@/components/ui/button";
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
import { useTournamentOperators } from "@/hooks/useTournamentOperators";
import { haptic } from "@/lib/feedback/haptic";

type Participant = {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
}

export function OperatorsTab({ tournamentId }: { tournamentId: string }) {
  const { user } = useAuth();
  const { operators, loading: opLoading, isOperator } = useTournamentOperators(tournamentId);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<{ kind: "add" | "remove"; participant: Participant } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: regs } = await supabase
        .from("tournament_registrations")
        .select("player1_user_id, player2_user_id, tournament_categories!inner(tournament_id)")
        .eq("tournament_categories.tournament_id", tournamentId)
        .eq("status", "confirmada");

      const ids = new Set<string>();
      (regs ?? []).forEach((r) => {
        const row = r as { player1_user_id: string | null; player2_user_id: string | null };
        if (row.player1_user_id) ids.add(row.player1_user_id);
        if (row.player2_user_id) ids.add(row.player2_user_id);
      });

      if (ids.size === 0) {
        setParticipants([]);
        setLoading(false);
        return;
      }

      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, avatar_url")
        .in("user_id", Array.from(ids));
      const mapped: Participant[] = (profs ?? []).map((p) => {
        const row = p as { user_id: string; first_name: string | null; last_name: string | null; avatar_url: string | null };
        const name = [row.first_name, row.last_name].filter(Boolean).join(" ").trim();
        return {
          user_id: row.user_id,
          display_name: name || "Jugador",
          avatar_url: row.avatar_url,
        };
      });
      mapped.sort((a, b) => a.display_name.localeCompare(b.display_name, "es"));
      setParticipants(mapped);
      setLoading(false);
    })();
  }, [tournamentId]);

  const handleConfirm = async () => {
    if (!pending || !user) return;
    setSubmitting(true);
    try {
      if (pending.kind === "add") {
        const { error } = await supabase.from("tournament_operators").insert({
          tournament_id: tournamentId,
          user_id: pending.participant.user_id,
          granted_by: user.id,
        });
        if (error) throw error;
        haptic("medium");
        toast({ title: "Operador asignado", description: `${pending.participant.display_name} ya puede operar este torneo.` });
      } else {
        const { error } = await supabase
          .from("tournament_operators")
          .delete()
          .eq("tournament_id", tournamentId)
          .eq("user_id", pending.participant.user_id);
        if (error) throw error;
        haptic("medium");
        toast({ title: "Operador quitado", description: `${pending.participant.display_name} ya no opera este torneo.` });
      }
      setPending(null);
    } catch (err) {
      toast({
        title: "No se pudo actualizar",
        description: err instanceof Error ? err.message : "Inténtalo nuevamente",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p className="text-xs leading-relaxed text-foreground">
          Un operador puede cargar resultados y mover canchas en vivo. Dale esta vista a jugadores de confianza para repartir la operación.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Participantes · {participants.length}
        </h3>
        {!opLoading && (
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {operators.length} operador{operators.length === 1 ? "" : "es"}
          </span>
        )}
      </div>

      {loading ? (
        <p className="rounded-2xl border border-dashed border-border bg-card/50 p-6 text-center text-sm text-muted-foreground">
          Cargando participantes…
        </p>
      ) : participants.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-card/50 p-6 text-center text-sm text-muted-foreground">
          Aún no hay participantes confirmados.
        </p>
      ) : (
        <div className="space-y-2">
          {participants.map((p) => {
            const active = isOperator(p.user_id);
            return (
              <div
                key={p.user_id}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card px-3 py-2.5"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                  {p.avatar_url ? (
                    <img src={p.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    initials(p.display_name)
                  )}
                </div>
                <p className="min-w-0 flex-1 truncate text-sm font-medium">{p.display_name}</p>
                {active ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 border-success/40 text-success hover:bg-success/10"
                    onClick={() => setPending({ kind: "remove", participant: p })}
                  >
                    <ShieldCheck className="mr-1 h-3.5 w-3.5" /> Operador
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0"
                    onClick={() => setPending({ kind: "add", participant: p })}
                  >
                    <UserPlus className="mr-1 h-3.5 w-3.5" /> Dar vista
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="px-1 text-[11px] text-muted-foreground">
        Puedes quitar el rol en cualquier momento.
      </p>

      <AlertDialog open={!!pending} onOpenChange={(open) => !open && !submitting && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pending?.kind === "add" ? "Asignar como operador" : "Quitar rol de operador"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pending?.kind === "add"
                ? `${pending?.participant.display_name} podrá cargar resultados y mover canchas en vivo de este torneo. No tendrá acceso a otras secciones admin.`
                : `${pending?.participant.display_name} dejará de tener acceso al tablero de operador.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} disabled={submitting}>
              {pending?.kind === "add" ? "Sí, dar vista" : "Sí, quitar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}