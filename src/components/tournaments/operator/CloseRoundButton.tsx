import { useState } from "react";
import { Loader2, RotateCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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
import { haptic } from "@/lib/feedback/haptic";

interface Props {
  categoryId: string;
  currentRound: number;
  targetRounds: number | null;
  allClosed: boolean;
  onDone: () => void | Promise<void>;
}

export function CloseRoundButton({
  categoryId,
  currentRound,
  targetRounds,
  allClosed,
  onDone,
}: Props) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isLast = targetRounds !== null && currentRound >= targetRounds;
  const nextRound = currentRound + 1;

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      if (isLast) {
        const { error } = await supabase.rpc("close_americano" as never, {
          _category_id: categoryId,
        } as never);
        if (error) throw error;
        haptic("success");
        toast({ title: "Competencia finalizada", description: "¡Felicitaciones al ganador!" });
      } else {
        const { error } = await supabase.rpc("generate_americano_round" as never, {
          _category_id: categoryId,
          _round_number: nextRound,
        } as never);
        if (error) throw error;
        haptic("heavy");
        toast({ title: `Ronda ${nextRound} generada`, description: "Nuevas parejas listas." });
      }
      setOpen(false);
      await onDone();
    } catch (err) {
      toast({
        title: "No se pudo cerrar la ronda",
        description: err instanceof Error ? err.message : "Inténtalo nuevamente",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Button
        size="lg"
        className="w-full"
        disabled={!allClosed}
        onClick={() => setOpen(true)}
      >
        <RotateCw className="mr-2 h-4 w-4" />
        {isLast ? "Cerrar y finalizar competencia" : `Cerrar ronda ${currentRound} y rotar parejas`}
      </Button>
      {!allClosed && (
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          Esperando que se cierren todas las canchas para rotar.
        </p>
      )}

      <AlertDialog open={open} onOpenChange={(v) => !submitting && setOpen(v)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isLast
                ? "Finalizar la competencia"
                : `Cerrar Ronda ${currentRound} y rotar parejas`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isLast
                ? "Esta es la última ronda. Se marcará la categoría como finalizada y se calcularán los standings finales."
                : `Vas a cerrar la ronda ${currentRound} y generar la ronda ${nextRound} con nuevas parejas según el algoritmo.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isLast ? "Sí, finalizar" : "Sí, cerrar y rotar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}