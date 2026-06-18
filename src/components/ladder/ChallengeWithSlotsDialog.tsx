import { useMemo, useState } from "react";
import { Loader2, Swords, Clock, AlertTriangle, ArrowLeft, ArrowRight } from "lucide-react";
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
import { cooldownDaysRemaining } from "@/lib/ladder-utils";
import type { LadderRow, PositionRow } from "@/hooks/useLadderData";
import { SlotPickerCalendar } from "./SlotPickerCalendar";
import { useBookingsProvider } from "@/hooks/useBookingsProvider";
import { EXTERNAL_BOOKING_COPY } from "@/lib/external-bookings-copy";
import { PartnerPicker } from "@/components/PartnerPicker";
import { Users } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ladder: LadderRow;
  myPosition: PositionRow;
  target: PositionRow;
  targetName: string;
  lastPlayedBetween: string | null;
  onCreated?: () => void;
}

export const ChallengeWithSlotsDialog = ({
  open,
  onOpenChange,
  ladder,
  myPosition,
  target,
  targetName,
  lastPlayedBetween,
  onCreated,
}: Props) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [slots, setSlots] = useState<string[]>([]);
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { isExternal } = useBookingsProvider();

  const isPadelDoubles = ladder.discipline === "padel_dobles";

  const cooldownLeft = useMemo(
    () => cooldownDaysRemaining(lastPlayedBetween, ladder.cooldown_days),
    [lastPlayedBetween, ladder.cooldown_days],
  );
  const positionsToClimb = myPosition.position - target.position;
  const blocked = cooldownLeft > 0;
  const canContinue = !blocked && (!isPadelDoubles || !!partnerId);

  const reset = () => {
    setStep(1);
    setSlots([]);
    setPartnerId(null);
    setSubmitting(false);
  };

  const handleSubmit = async () => {
    if (slots.length !== 3) return;
    if (isPadelDoubles && !partnerId) {
      toast({ title: "Elige un compañero", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const payload = slots
      .slice()
      .sort()
      .map((iso) => ({ starts_at: iso }));
    const { error } = await supabase.rpc("create_ladder_challenge_with_slots", {
      _ladder_id: ladder.id,
      _challenged_user_id: target.user_id,
      _slots: payload,
      ...(isPadelDoubles ? { _challenger_partner_user_id: partnerId } : {}),
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
      description: `${targetName} debe elegir uno de tus 3 horarios antes de ${ladder.response_window_hours}h.`,
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
            {step === 1 ? "Desafiar" : "Elige 3 horarios"}
          </DialogTitle>
          <DialogDescription>
            {step === 1
              ? `Vas a retar a ${targetName}.`
              : isExternal
                ? `Superficie: ${ladder.surface}. Tu rival elegirá uno de los 3 horarios; la cancha se reserva aparte en EasyCancha.`
                : `Superficie: ${ladder.surface}. La cancha se asigna automáticamente.`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {step === 2 && isExternal && (
            <div
              role="note"
              className="mb-4 flex items-start gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-[12px] leading-snug text-amber-900 dark:text-amber-200"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{EXTERNAL_BOOKING_COPY.banner}</p>
            </div>
          )}
          {step === 1 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-2xl border border-border bg-muted/40 p-3">
                <div className="text-center">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Tú</p>
                  <p className="font-display text-2xl font-semibold">#{myPosition.position}</p>
                </div>
                <div className="text-center text-xs text-muted-foreground">
                  <p>Subes</p>
                  <p className="font-display text-lg font-semibold text-primary">
                    +{positionsToClimb}
                  </p>
                  <p>posición{positionsToClimb === 1 ? "" : "es"}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Rival</p>
                  <p className="font-display text-2xl font-semibold text-primary">
                    #{target.position}
                  </p>
                </div>
              </div>

              <ul className="space-y-2 text-xs text-muted-foreground">
                <li className="flex items-start gap-2">
                  <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    Tu rival tiene <strong>{ladder.response_window_hours}h</strong> para elegir uno
                    de los 3 horarios que propongas.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    Si no responde, el desafío <strong>se elimina</strong> y se les avisa a ambos.
                  </span>
                </li>
                {ladder.cooldown_days > 0 && (
                  <li className="flex items-start gap-2">
                    <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>
                      Cooldown entre el mismo par: <strong>{ladder.cooldown_days} días</strong>.
                    </span>
                  </li>
                )}
              </ul>

              {blocked && (
                <div className="flex items-start gap-2 rounded-2xl border border-warning/40 bg-warning/10 p-3 text-xs text-warning-foreground">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                  <span>
                    Cooldown activo: faltan{" "}
                    <strong>
                      {cooldownLeft} día{cooldownLeft === 1 ? "" : "s"}
                    </strong>{" "}
                    para que puedas volver a desafiar a este jugador.
                  </span>
                </div>
              )}

              {isPadelDoubles && (
                <div className="space-y-2 rounded-2xl border border-border bg-card p-3">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <Users className="h-3.5 w-3.5" /> Tu compañero de pareja
                  </p>
                  <PartnerPicker
                    value={partnerId}
                    onChange={(id) => setPartnerId(id)}
                    excludeUserId={target.user_id}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Debe estar inscrito en esta Pirámide. {targetName} elegirá a su compañero al
                    aceptar el desafío.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <SlotPickerCalendar
              tenantId={ladder.tenant_id}
              surface={ladder.surface}
              windowDays={Math.max(1, Math.ceil(ladder.response_window_hours / 24))}
              value={slots}
              onChange={setSlots}
              max={3}
            />
          )}
        </div>

        <DialogFooter className="gap-2 border-t border-border px-5 py-3">
          {step === 1 ? (
            <>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                variant="clay"
                onClick={() => setStep(2)}
                disabled={!canContinue}
                className="flex-1"
              >
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
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  `Enviar ${slots.length}/3`
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
