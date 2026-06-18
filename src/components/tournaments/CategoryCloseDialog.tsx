import { useMemo, useState } from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import type { Match, Player, Registration } from "@/hooks/useCategoryData";
import { registrationLabel } from "@/hooks/useCategoryData";

interface CategoryCloseDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  categoryId: string;
  matches: Match[];
  registrations: Registration[];
  players: Map<string, Player>;
  onClosed: () => void;
}

type WoDecision = { include: boolean; winnerRegId: string | null };

export const CategoryCloseDialog = ({
  open,
  onOpenChange,
  categoryId,
  matches,
  registrations,
  players,
  onClosed,
}: CategoryCloseDialogProps) => {
  const regsById = useMemo(
    () => new Map(registrations.map((r) => [r.id, r])),
    [registrations],
  );

  // Partidos pendientes que tienen ambos jugadores asignados (los que se podrían cerrar por W.O.)
  const pendingMatches = useMemo(
    () =>
      matches.filter(
        (m) =>
          m.registration_a_id &&
          m.registration_b_id &&
          m.status !== "jugado" &&
          m.status !== "walkover" &&
          m.status !== "cancelado",
      ),
    [matches],
  );

  const [decisions, setDecisions] = useState<Record<string, WoDecision>>({});
  const [submitting, setSubmitting] = useState(false);

  const setDecision = (id: string, patch: Partial<WoDecision>) => {
    setDecisions((d) => ({
      ...d,
      [id]: { include: false, winnerRegId: null, ...d[id], ...patch },
    }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      // 1. Enviar W.O. para los partidos marcados
      const toClose = pendingMatches.filter((m) => decisions[m.id]?.include);
      for (const m of toClose) {
        const winner = decisions[m.id]?.winnerRegId;
        if (!winner) {
          toast({
            title: "Selecciona ganador",
            description: "Elige quién avanza por W.O. en cada partido marcado.",
            variant: "destructive",
          });
          setSubmitting(false);
          return;
        }
        const { error } = await supabase.rpc("submit_match_result", {
          _match_id: m.id,
          _winner_registration_id: winner,
          _score: null as never,
          _walkover: true,
          _retired: false,
        });
        if (error) throw new Error(error.message);
      }

      // 2. Marcar la categoría como finalizada
      const { error: catErr } = await supabase
        .from("tournament_categories")
        .update({ status: "finalizado" })
        .eq("id", categoryId);
      if (catErr) throw new Error(catErr.message);

      toast({
        title: "Categoría finalizada",
        description:
          toClose.length > 0
            ? `Se cerraron ${toClose.length} partido(s) por W.O. y se marcó la categoría como finalizada.`
            : "La categoría quedó marcada como finalizada.",
      });
      onOpenChange(false);
      setDecisions({});
      onClosed();
    } catch (err) {
      toast({
        title: "Error al cerrar la categoría",
        description: err instanceof Error ? err.message : "Inténtalo nuevamente",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Finalizar categoría</DialogTitle>
          <DialogDescription>
            {pendingMatches.length === 0
              ? "Todos los partidos están resueltos. Confirma para marcar la categoría como finalizada."
              : `Quedan ${pendingMatches.length} partido(s) pendiente(s). Puedes marcarlos como W.O. ahora o dejarlos pendientes y finalizar igual.`}
          </DialogDescription>
        </DialogHeader>

        {pendingMatches.length > 0 && (
          <div className="space-y-3 py-2">
            <div className="flex items-start gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                Los W.O. asignan ganador y avanzan el bracket. Si dejas un partido sin marcar, se
                quedará como pendiente aunque la categoría esté finalizada.
              </p>
            </div>

            <div className="max-h-[40vh] space-y-2 overflow-y-auto pr-1">
              {pendingMatches.map((m) => {
                const regA = m.registration_a_id ? regsById.get(m.registration_a_id) : undefined;
                const regB = m.registration_b_id ? regsById.get(m.registration_b_id) : undefined;
                const dec = decisions[m.id] ?? { include: false, winnerRegId: null };
                return (
                  <div
                    key={m.id}
                    className="rounded-2xl border border-border bg-card p-3 text-sm"
                  >
                    <label className="flex items-center gap-2">
                      <Checkbox
                        checked={dec.include}
                        onCheckedChange={(v) => setDecision(m.id, { include: !!v })}
                      />
                      <span className="font-medium">Cerrar por W.O.</span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        Ronda {m.round}
                      </span>
                    </label>
                    {dec.include && regA && regB && (
                      <div className="mt-2 pl-6">
                        <p className="mb-1 text-xs text-muted-foreground">Avanza:</p>
                        <RadioGroup
                          value={dec.winnerRegId ?? ""}
                          onValueChange={(v) => setDecision(m.id, { winnerRegId: v })}
                        >
                          <label className="flex items-center gap-2 text-xs">
                            <RadioGroupItem value={regA.id} />
                            {registrationLabel(regA, players)}
                          </label>
                          <label className="flex items-center gap-2 text-xs">
                            <RadioGroupItem value={regB.id} />
                            {registrationLabel(regB, players)}
                          </label>
                        </RadioGroup>
                      </div>
                    )}
                    {!dec.include && regA && regB && (
                      <p className="mt-1 pl-6 text-xs text-muted-foreground">
                        {registrationLabel(regA, players)} vs {registrationLabel(regB, players)}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Finalizar categoría
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
