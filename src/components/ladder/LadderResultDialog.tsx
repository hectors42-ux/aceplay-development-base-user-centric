import { useState } from "react";
import { Loader2, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/components/providers/AuthProvider";
import type { ChallengeRow, ProfileLite } from "@/hooks/useLadderData";
import {
  ScoreboardEditor,
  editorToSetScores,
  emptyScoreboardValue,
  validateScoreboardValue,
  type ScoreboardEditorValue,
} from "@/components/match/ScoreboardEditor";

interface Props {
  challenge: ChallengeRow;
  opponent?: ProfileLite;
  onClose: () => void;
  onSubmitted: () => void;
}

const fullName = (p?: ProfileLite) =>
  p ? `${p.first_name} ${p.last_name}`.trim() : "Jugador";

/**
 * Diálogo de carga de resultado para desafíos de Escalerilla.
 * Convierte el value del scoreboard (siempre desde la perspectiva del usuario)
 * al formato canónico challenger/challenged que espera `submit_ladder_result`.
 */
export const LadderResultDialog = ({ challenge, opponent, onClose, onSubmitted }: Props) => {
  const { user, profile } = useAuth();
  const [value, setValue] = useState<ScoreboardEditorValue>(emptyScoreboardValue());
  const [submitting, setSubmitting] = useState(false);

  if (!user) return null;
  const isChallenger = challenge.challenger_user_id === user.id;
  const myUserId = user.id;
  const opponentId = isChallenger ? challenge.challenged_user_id : challenge.challenger_user_id;
  const meName =
    profile ? `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() || "Tú" : "Tú";

  const handleSubmit = async () => {
    const isWalkover = value.outcome === "walkover";
    const editorSets = editorToSetScores(value);

    const validation = validateScoreboardValue(value, myUserId, opponentId);
    if (!validation.ok) {
      toast({ title: validation.message, variant: "destructive" });
      return;
    }

    const isRetired = value.outcome === "retired";
    // RPC espera score en orden challenger/challenged.
    const sets = editorSets.map((s) => (isChallenger ? { a: s.a, b: s.b } : { a: s.b, b: s.a }));

    setSubmitting(true);
    const { error } = await supabase.rpc("submit_ladder_result", {
      _challenge_id: challenge.id,
      _winner_user_id: value.winnerId,
      _score: (isWalkover ? null : sets) as never,
      _walkover: isWalkover,
      _retired: isRetired,
    });
    setSubmitting(false);
    if (error) {
      toast({
        title: "No se pudo cargar el resultado",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "Resultado enviado",
      description: "Tu rival debe confirmarlo para que cuente.",
    });
    onSubmitted();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md rounded-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <Trophy className="h-5 w-5 text-primary" /> Cargar resultado
          </DialogTitle>
          <DialogDescription>
            Partido vs {fullName(opponent)}. Tu rival deberá confirmarlo.
          </DialogDescription>
        </DialogHeader>

        <ScoreboardEditor
          me={{ id: myUserId, name: meName, avatarUrl: profile?.avatar_url ?? null }}
          opponent={{
            id: opponentId,
            name: fullName(opponent),
            avatarUrl: opponent?.avatar_url ?? null,
          }}
          value={value}
          onChange={setValue}
        />

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={submitting} className="flex-1">
            Cancelar
          </Button>
          <Button variant="clay" onClick={handleSubmit} disabled={submitting} className="flex-1">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
