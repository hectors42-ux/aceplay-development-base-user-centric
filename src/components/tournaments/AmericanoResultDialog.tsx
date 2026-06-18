import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import type { Match, Player } from "@/hooks/useCategoryData";
import { playerName } from "@/hooks/useCategoryData";
import {
  ScoreboardEditor,
  editorToSetScores,
  emptyScoreboardValue,
  type ScoreboardEditorValue,
} from "@/components/match/ScoreboardEditor";
import {
  resolveScoringProfile,
  validateScore as validateProfileScore,
  type ScoringProfile,
} from "@/lib/scoring-profile";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  match: Match | null;
  players: Map<string, Player>;
  category?: { config?: unknown } | null;
  onSubmitted: () => void;
}

function pairLabel(ids: string[] | null | undefined, players: Map<string, Player>): string {
  if (!ids || ids.length === 0) return "—";
  return ids.map((id) => playerName(players.get(id), "Jugador")).join(" / ");
}

export const AmericanoResultDialog = ({
  open,
  onOpenChange,
  match,
  players,
  category,
  onSubmitted,
}: Props) => {
  const [value, setValue] = useState<ScoreboardEditorValue>(emptyScoreboardValue());
  const [submitting, setSubmitting] = useState(false);

  const profile: ScoringProfile | undefined = useMemo(
    () => (category ? resolveScoringProfile(category) : undefined),
    [category],
  );

  const sideA = (match as unknown as { side_a_user_ids?: string[] })?.side_a_user_ids ?? [];
  const sideB = (match as unknown as { side_b_user_ids?: string[] })?.side_b_user_ids ?? [];

  if (!match) return null;

  const reset = () => setValue(emptyScoreboardValue());

  const handleSubmit = async () => {
    const isWalkover = value.outcome === "walkover";
    const sets = editorToSetScores(value, profile);
    if (!value.winnerId) {
      toast({ title: "Elegí el ganador", variant: "destructive" });
      return;
    }
    const winnerSide = value.winnerId === "a" ? "a" : "b";
    if (!isWalkover && profile) {
      const check = validateProfileScore(sets, profile);
      if (check.ok === false) {
        toast({ title: check.error, variant: "destructive" });
        return;
      }
    }
    setSubmitting(true);
    const { error } = await supabase.rpc("submit_americano_result" as never, {
      _match_id: match.id,
      _winner_side: winnerSide,
      _score: (isWalkover ? null : sets) as never,
      _walkover: isWalkover,
    } as never);
    setSubmitting(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Resultado registrado" });
    reset();
    onOpenChange(false);
    onSubmitted();
  };

  const labelA = pairLabel(sideA, players);
  const labelB = pairLabel(sideB, players);

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
          <DialogTitle>Cargar resultado · Mesa {match.bracket_position}</DialogTitle>
          <DialogDescription>
            {labelA} vs {labelB}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            Score
          </Label>
          <ScoreboardEditor
            me={{ id: "a", name: labelA }}
            opponent={{ id: "b", name: labelB }}
            value={value}
            onChange={setValue}
            profile={profile}
          />
        </div>

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