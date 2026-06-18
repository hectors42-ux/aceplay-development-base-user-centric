import { useState } from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";

interface DeleteTournamentDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tournament: { id: string; name: string; status: string } | null;
  onDeleted: () => void;
}

const ALLOWED_DELETE_STATUSES = ["borrador", "cancelado", "finalizado"];

export const DeleteTournamentDialog = ({
  open,
  onOpenChange,
  tournament,
  onDeleted,
}: DeleteTournamentDialogProps) => {
  const [confirmText, setConfirmText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!tournament) return null;

  const allowed = ALLOWED_DELETE_STATUSES.includes(tournament.status);
  const canDelete = allowed && confirmText.trim() === tournament.name.trim();

  const handleDelete = async () => {
    setSubmitting(true);
    const { error } = await supabase.from("tournaments").delete().eq("id", tournament.id);
    setSubmitting(false);
    if (error) {
      toast({ title: "Error al eliminar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Torneo eliminado" });
    setConfirmText("");
    onOpenChange(false);
    onDeleted();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) setConfirmText("");
        onOpenChange(v);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Eliminar torneo</DialogTitle>
          <DialogDescription>
            Esta acción borra el torneo, sus categorías, inscripciones, partidos y resultados de
            forma permanente. No se puede deshacer.
          </DialogDescription>
        </DialogHeader>

        {!allowed ? (
          <div className="flex items-start gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" />
            <p className="text-amber-900 dark:text-amber-200">
              Solo puedes eliminar torneos en estado <strong>borrador</strong>,{" "}
              <strong>cancelado</strong> o <strong>finalizado</strong>. Cancela el torneo primero.
            </p>
          </div>
        ) : (
          <div className="space-y-2 py-2">
            <Label htmlFor="confirm">
              Para confirmar, escribe el nombre del torneo:{" "}
              <span className="font-semibold">{tournament.name}</span>
            </Label>
            <Input
              id="confirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={tournament.name}
              autoComplete="off"
            />
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={!canDelete || submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Eliminar definitivamente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
