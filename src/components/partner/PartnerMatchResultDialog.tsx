import { useState } from "react";
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
import { toast } from "sonner";
import {
  ScoreboardEditor,
  editorToSetScores,
  emptyScoreboardValue,
  validateScoreboardValue,
  type ScoreboardEditorValue,
} from "@/components/match/ScoreboardEditor";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  invitationId: string;
  meId: string;
  meName: string;
  opponentId: string;
  opponentName: string;
  onSubmitted?: () => void;
}

/**
 * Diálogo para cargar el resultado de un partido amistoso (partner match).
 * Usa `ScoreboardEditor` para presentar un cuadro de tenis editable.
 */
export const PartnerMatchResultDialog = ({
  open,
  onOpenChange,
  invitationId,
  meId,
  meName,
  opponentId,
  opponentName,
  onSubmitted,
}: Props) => {
  const [value, setValue] = useState<ScoreboardEditorValue>(emptyScoreboardValue());
  const [submitting, setSubmitting] = useState(false);

  const reset = () => setValue(emptyScoreboardValue());

  const handleSubmit = async () => {
    const sets = editorToSetScores(value);
    const isWalkover = value.outcome === "walkover";
    const isRetired = value.outcome === "retired";

    const validation = validateScoreboardValue(value, meId, opponentId);
    if (!validation.ok) {
      toast.error(validation.message);
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.rpc("submit_partner_match_result", {
      _invitation_id: invitationId,
      _winner_user_id: value.winnerId,
      _score: (isWalkover ? null : sets) as never,
      _walkover: isWalkover,
      _retired: isRetired,
    });
    setSubmitting(false);
    if (error) {
      toast.error("No se pudo cargar el resultado", { description: error.message });
      return;
    }
    toast.success("Resultado propuesto", {
      description: `${opponentName} debe confirmar para que se aplique al rating.`,
    });
    reset();
    onOpenChange(false);
    onSubmitted?.();
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
          <DialogTitle>Cargar resultado del amistoso</DialogTitle>
          <DialogDescription>
            {meName} vs {opponentName}
          </DialogDescription>
        </DialogHeader>

        <ScoreboardEditor
          me={{ id: meId, name: meName }}
          opponent={{ id: opponentId, name: opponentName }}
          value={value}
          onChange={setValue}
          helperText={`Los amistosos afectan tu rating con un peso menor. El cambio se aplica cuando ${opponentName} confirma el resultado.`}
        />

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submitting} variant="clay">
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enviar resultado
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
