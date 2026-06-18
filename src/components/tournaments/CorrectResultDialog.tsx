import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import {
  Match,
  Registration,
  Player,
  registrationLabel,
} from "@/hooks/useCategoryData";
import {
  ScoreboardEditor,
  editorToSetScores,
  emptyScoreboardValue,
  validateScoreboardValue,
  type ScoreboardEditorValue,
} from "@/components/match/ScoreboardEditor";
import type { SetScore } from "@/lib/tournament-utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  match: Match | null;
  allMatches: Match[];
  registrations: Registration[];
  players: Map<string, Player>;
  onCorrected: () => void;
}

/** Construye el value inicial del editor a partir del score guardado. */
function matchToEditorValue(match: Match, regA?: Registration, regB?: Registration): ScoreboardEditorValue {
  const empty = emptyScoreboardValue();
  if (!match.score || !Array.isArray(match.score)) return empty;
  const sets = (match.score as unknown as SetScore[]).map((s) => ({
    me: typeof s.a === "number" ? s.a : null,
    opp: typeof s.b === "number" ? s.b : null,
    tb: typeof s.tb === "number" ? s.tb : null,
  }));
  const winnerId =
    match.winner_registration_id === regA?.id
      ? regA?.id ?? null
      : match.winner_registration_id === regB?.id
        ? regB?.id ?? null
        : null;
  return { outcome: "score", sets: sets.length ? sets : empty.sets, winnerId };
}

export const CorrectResultDialog = ({
  open,
  onOpenChange,
  match,
  allMatches,
  registrations,
  players,
  onCorrected,
}: Props) => {
  const regsById = useMemo(() => new Map(registrations.map((r) => [r.id, r])), [registrations]);
  const regA = match?.registration_a_id ? regsById.get(match.registration_a_id) : undefined;
  const regB = match?.registration_b_id ? regsById.get(match.registration_b_id) : undefined;

  const [value, setValue] = useState<ScoreboardEditorValue>(emptyScoreboardValue());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (match && open) setValue(matchToEditorValue(match, regA, regB));
  }, [match, open, regA, regB]);

  // Detecta partidos dependientes ya jugados siguiendo la cadena next_match_id
  const dependentsPlayed = useMemo(() => {
    if (!match) return [] as Match[];
    const byId = new Map(allMatches.map((m) => [m.id, m]));
    const out: Match[] = [];
    let next = match.next_match_id ? byId.get(match.next_match_id) : null;
    while (next) {
      if (next.status === "jugado") out.push(next);
      else break;
      next = next.next_match_id ? byId.get(next.next_match_id) ?? null : null;
    }
    return out;
  }, [match, allMatches]);

  if (!match) return null;

  const handleSubmit = async () => {
    if (!regA || !regB) {
      toast({ title: "Faltan jugadores en este partido", variant: "destructive" });
      return;
    }
    const validation = validateScoreboardValue(value, regA.id, regB.id);
    if (!validation.ok) {
      toast({ title: validation.message, variant: "destructive" });
      return;
    }
    if (!value.winnerId) return;

    if (dependentsPlayed.length > 0) {
      const ok = window.confirm(
        `Hay ${dependentsPlayed.length} partido(s) posterior(es) ya jugado(s). ` +
          `Al corregir, esos resultados quedan marcados para revisión. ¿Continuar?`,
      );
      if (!ok) return;
    }

    setSubmitting(true);
    const sets = editorToSetScores(value);
    const { error } = await supabase.rpc("correct_match_result", {
      _tournament_match_id: match.id,
      _new_score: sets as never,
      _new_winner_registration_id: value.winnerId,
    });
    if (error) {
      setSubmitting(false);
      toast({ title: "Error al corregir", description: error.message, variant: "destructive" });
      return;
    }
    if (dependentsPlayed.length > 0) {
      await supabase.rpc("flag_dependent_matches_for_review", {
        _corrected_match_id: match.id,
      });
    }
    setSubmitting(false);
    toast({ title: "Resultado corregido", description: "El rating se actualizó automáticamente." });
    onOpenChange(false);
    onCorrected();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Ajustar resultado</DialogTitle>
          <DialogDescription>
            {registrationLabel(regA, players)} vs {registrationLabel(regB, players)}
          </DialogDescription>
        </DialogHeader>

        {dependentsPlayed.length > 0 && (
          <div className="flex items-start gap-2 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div>
              <p className="font-medium text-foreground">
                Hay {dependentsPlayed.length} partido(s) dependiente(s) ya jugado(s)
              </p>
              <p className="text-muted-foreground">
                Corregir este resultado puede invalidar los siguientes. Se marcarán para revisión.
              </p>
            </div>
          </div>
        )}

        <ScoreboardEditor
          me={{ id: regA?.id ?? "a", name: registrationLabel(regA, players) }}
          opponent={{ id: regB?.id ?? "b", name: registrationLabel(regB, players) }}
          value={value}
          onChange={setValue}
        />

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar corrección
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};