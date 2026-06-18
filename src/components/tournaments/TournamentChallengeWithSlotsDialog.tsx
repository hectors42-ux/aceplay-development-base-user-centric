import { useState } from "react";
import { ArrowLeft, ArrowRight, Loader2, Swords } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SlotPickerCalendar } from "@/components/ladder/SlotPickerCalendar";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  categoryId: string;
  opponentUserId: string;
  opponentName: string;
  surface?: string;
  onCreated?: () => void;
}

export const TournamentChallengeWithSlotsDialog = ({
  open,
  onOpenChange,
  tenantId,
  categoryId,
  opponentUserId,
  opponentName,
  surface = "arcilla",
  onCreated,
}: Props) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [slots, setSlots] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setStep(1);
    setSlots([]);
    setSubmitting(false);
  };

  const handleSubmit = async () => {
    if (slots.length !== 3) return;
    setSubmitting(true);
    const payload = slots.slice().sort().map((iso) => ({ starts_at: iso }));
    const { error } = await supabase.rpc("create_tournament_challenge" as never, {
      _category_id: categoryId,
      _challenged_user_id: opponentUserId,
      _slots: payload,
    } as never);
    setSubmitting(false);
    if (error) {
      toast({
        title: "No se pudo crear el desafío",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "¡Desafío enviado!",
      description: `${opponentName} debe elegir uno de tus 3 horarios.`,
    });
    reset();
    onOpenChange(false);
    onCreated?.();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col rounded-3xl p-0">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle className="flex items-center gap-2 font-display">
            <Swords className="h-5 w-5 text-primary" />
            {step === 1 ? "Desafiar en el torneo" : "Elige 3 horarios"}
          </DialogTitle>
          <DialogDescription>
            {step === 1
              ? `Vas a retar a ${opponentName} por su partido del round robin.`
              : `Tu rival elegirá uno de los 3 horarios que propongas.`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {step === 1 ? (
            <div className="rounded-2xl border border-border bg-muted/40 p-3 text-sm">
              <p className="font-medium">{opponentName}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Al cargar el resultado, los puntos se sumarán a la tabla del round robin.
              </p>
            </div>
          ) : (
            <SlotPickerCalendar
              tenantId={tenantId}
              surface={surface}
              windowDays={7}
              value={slots}
              onChange={setSlots}
              max={3}
            />
          )}
        </div>

        <DialogFooter className="gap-2 border-t border-border px-5 py-3">
          {step === 1 ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
                Cancelar
              </Button>
              <Button variant="clay" onClick={() => setStep(2)} className="flex-1">
                Continuar <ArrowRight className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                <ArrowLeft className="h-4 w-4" /> Volver
              </Button>
              <Button
                variant="clay"
                onClick={handleSubmit}
                disabled={submitting || slots.length !== 3}
                className="flex-1"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : `Enviar ${slots.length}/3`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};