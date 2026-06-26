import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
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
import { useAuth } from "@/components/providers/AuthProvider";
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
import {
  resolveScoringProfile,
  validateScore as validateProfileScore,
  type ScoringProfile,
} from "@/lib/scoring-profile";

interface ResultDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  match: Match | null;
  registrations: Registration[];
  players: Map<string, Player>;
  onSubmitted: () => void;
  /** Categoría del partido — para resolver el perfil de scoring (PRD 8). */
  category?: { config?: unknown } | null;
}

export const ResultDialog = ({
  open,
  onOpenChange,
  match,
  registrations,
  players,
  onSubmitted,
  category,
}: ResultDialogProps) => {
  const [value, setValue] = useState<ScoreboardEditorValue>(emptyScoreboardValue());
  const [submitting, setSubmitting] = useState(false);
  const { user } = useAuth();
  // Sólo aplicamos el profile cuando la página explícitamente pasó la categoría;
  // así los flujos legacy (y tests) no son afectados.
  const profile: ScoringProfile | undefined = useMemo(
    () => (category ? resolveScoringProfile(category) : undefined),
    [category],
  );

  const regsById = useMemo(
    () => new Map(registrations.map((r) => [r.id, r])),
    [registrations],
  );
  const regA = match?.registration_a_id ? regsById.get(match.registration_a_id) : undefined;
  const regB = match?.registration_b_id ? regsById.get(match.registration_b_id) : undefined;

  if (!match) return null;

  const reset = () => setValue(emptyScoreboardValue());

  const handleSubmit = async () => {
    if (!regA || !regB) {
      toast({ title: "Faltan jugadores en este partido", variant: "destructive" });
      return;
    }
    const sets = editorToSetScores(value, profile);
    const isWalkover = value.outcome === "walkover";
    const isRetired = value.outcome === "retired";

    const meId = regA.id;
    const opponentId = regB.id;
    const validation = validateScoreboardValue(value, meId, opponentId, profile);
    if (!validation.ok) {
      toast({ title: validation.message, variant: "destructive" });
      return;
    }
    if (!isWalkover && !isRetired && profile) {
      const profileCheck = validateProfileScore(sets, profile);
      if (profileCheck.ok === false) {
        toast({ title: profileCheck.error, variant: "destructive" });
        return;
      }
    }

    setSubmitting(true);
    // RPC VIVO (submit_match_result está MUERTA). Brackets/grupos/americano/RR-del-motor:
    //  · si quien carga ES jugador del partido → play_bracket_match (_winner_is_me).
    //  · si es el ORGANIZADOR (no juega) → org_record_bracket_result (_winner_side, gateado).
    // En ambos el match queda 'pending' y el rating/avance del cuadro ocurren al CONFIRMARSE
    // (no se bypassa el firewall). La carga de round-robin roster (Fase A) vive en la casa del
    // organizador (rr_record_result); ese caso no llega aquí (no genera Match en el bundle).
    const winnerReg = value.winnerId === regA.id ? regA : regB;
    const liveSets = (isWalkover ? [] : sets).map((s) => ({
      games_a: s.a,
      games_b: s.b,
      is_tiebreak: s.kind === "super_tb" || typeof s.tb === "number",
    }));
    const meInMatch =
      !!user?.id &&
      [regA.player1_user_id, regA.player2_user_id, regB.player1_user_id, regB.player2_user_id].includes(user.id);

    let error;
    if (meInMatch) {
      const winnerIsMe = winnerReg.player1_user_id === user!.id || winnerReg.player2_user_id === user!.id;
      ({ error } = await supabase.rpc("play_bracket_match", {
        _slot_id: match.id, _winner_is_me: winnerIsMe, _sets: liveSets as never,
      }));
    } else {
      ({ error } = await supabase.rpc("org_record_bracket_result", {
        _slot_id: match.id, _winner_side: value.winnerId === regA.id ? "a" : "b", _sets: liveSets as never,
      }));
    }
    setSubmitting(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Resultado cargado · esperando confirmación" });

    reset();
    onOpenChange(false);
    onSubmitted();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Cargar resultado</DialogTitle>
          <DialogDescription>
            {registrationLabel(regA, players)} vs {registrationLabel(regB, players)}
          </DialogDescription>
        </DialogHeader>

        <ScoreboardEditor
          me={{ id: regA?.id ?? "a", name: registrationLabel(regA, players) }}
          opponent={{ id: regB?.id ?? "b", name: registrationLabel(regB, players) }}
          value={value}
          onChange={setValue}
          profile={profile}
        />

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enviar resultado
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
