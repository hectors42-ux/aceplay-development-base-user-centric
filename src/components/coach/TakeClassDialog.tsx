import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Loader2, Calendar as CalIcon, Users, User as UserIcon, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import { useActiveSport } from "@/components/providers/SportProvider";
import { useCoachSlots, type SlotOption } from "@/hooks/useCoachSlots";
import type { CoachWithProfile } from "@/hooks/useCoaches";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PartnerPicker } from "@/components/PartnerPicker";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Props {
  coach: CoachWithProfile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ClassKind = "socio_individual" | "socio_compartida";

export const TakeClassDialog = ({ coach, open, onOpenChange }: Props) => {
  const { user } = useAuth();
  const { sport } = useActiveSport();
  const qc = useQueryClient();
  const isPadel = sport === "padel";
  const durationOptions = isPadel ? [90] : [60, 120];
  const defaultDuration = isPadel ? 90 : 60;
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [kind, setKind] = useState<ClassKind>("socio_individual");
  const [duration, setDuration] = useState<number>(defaultDuration);
  const [selectedSlot, setSelectedSlot] = useState<SlotOption | null>(null);
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [partnerName, setPartnerName] = useState<string | null>(null);

  // Mantener la duración válida al cambiar de deporte
  useEffect(() => {
    if (!durationOptions.includes(duration)) setDuration(defaultDuration);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPadel]);

  const { slots } = useCoachSlots({
    coachId: coach?.id ?? null,
    duration,
    enabled: open,
    sport,
  });

  const createClass = useMutation({
    mutationFn: async (slot: SlotOption) => {
      if (!coach || !user) throw new Error("missing");
      if (kind === "socio_compartida" && !partnerId) {
        throw new Error("Selecciona al 2° alumno para clase compartida");
      }
      const { data, error } = await supabase.rpc("create_coach_class", {
        _coach_id: coach.id,
        _court_id: slot.courtId,
        _starts_at: slot.startsAt.toISOString(),
        _duration_minutes: slot.durationMin,
        _kind: kind,
        _student1_user_id: user.id,
        _student2_user_id: kind === "socio_compartida" ? partnerId : null,
        _external_student_name: null,
        _external_student_phone: null,
        _notes: null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("¡Clase solicitada! El coach debe confirmarla.");
      qc.invalidateQueries({ queryKey: ["my-student-classes"] });
      qc.invalidateQueries({ queryKey: ["coach-upcoming-classes"] });
      onOpenChange(false);
      setStep(1);
      setSelectedSlot(null);
      setPartnerId(null);
      setPartnerName(null);
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "No se pudo crear la clase");
    },
  });

  // (slots vienen de useCoachSlots arriba)

  const slotsByDay = slots.reduce<Record<string, SlotOption[]>>((acc, s) => {
    const k = format(s.startsAt, "yyyy-MM-dd");
    (acc[k] ||= []).push(s);
    return acc;
  }, {});

  const price =
    kind === "socio_individual"
      ? coach?.hourly_rate_member_clp ?? 0
      : coach?.hourly_rate_shared_clp ?? 0;
  const totalPrice = Math.round((price * duration) / 60);

  if (!coach) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">
            Tomar clase con {coach.profile?.first_name}
          </DialogTitle>
          <DialogDescription>
            Paso {step} de 3 · {step === 1 ? "Tipo de clase" : step === 2 ? "Elige horario" : "Confirmar"}
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setKind("socio_individual")}
                className={cn(
                  "rounded-2xl border-2 p-4 text-left transition-smooth",
                  kind === "socio_individual"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/40",
                )}
              >
                <UserIcon className="mb-2 h-5 w-5 text-primary" />
                <p className="font-display font-semibold">Individual</p>
                <p className="text-xs text-muted-foreground">Tú con el coach</p>
                <p className="mt-2 text-sm font-semibold">
                  ${coach.hourly_rate_member_clp.toLocaleString("es-CL")}/h
                </p>
              </button>
              <button
                onClick={() => setKind("socio_compartida")}
                className={cn(
                  "rounded-2xl border-2 p-4 text-left transition-smooth",
                  kind === "socio_compartida"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/40",
                )}
              >
                <Users className="mb-2 h-5 w-5 text-primary" />
                <p className="font-display font-semibold">Compartida</p>
                <p className="text-xs text-muted-foreground">Avisas al 2°</p>
                <p className="mt-2 text-sm font-semibold">
                  ${coach.hourly_rate_shared_clp.toLocaleString("es-CL")}/h c/u
                </p>
              </button>
            </div>

            {kind === "socio_compartida" && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  2° alumno (socio del club)
                </p>
                <PartnerPicker
                  value={partnerId}
                  onChange={(id, m) => {
                    setPartnerId(id);
                    setPartnerName(m ? `${m.first_name} ${m.last_name}` : null);
                  }}
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Tu compañero/a podrá ver la clase en su agenda.
                </p>
              </div>
            )}

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Duración
              </p>
              <div className={cn("grid gap-2", durationOptions.length === 1 ? "grid-cols-1" : "grid-cols-2")}>
                {durationOptions.map((d) => (
                  <button
                    key={d}
                    onClick={() => setDuration(d)}
                    className={cn(
                      "rounded-xl border-2 px-3 py-2 text-sm font-medium transition-smooth",
                      duration === d
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/40",
                    )}
                  >
                    {d} minutos
                  </button>
                ))}
              </div>
            </div>

            <Button
              onClick={() => setStep(2)}
              className="w-full"
              variant="clay"
              disabled={kind === "socio_compartida" && !partnerId}
            >
              Ver horarios disponibles
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <ScrollArea className="h-[360px] rounded-xl border border-border p-2">
              {Object.keys(slotsByDay).length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
                  <CalIcon className="h-8 w-8 opacity-40" />
                  <p>No hay horarios disponibles los próximos 7 días.</p>
                </div>
              ) : (
                Object.entries(slotsByDay).map(([day, daySlots]) => (
                  <div key={day} className="mb-3">
                    <p className="mb-1 px-1 text-xs font-semibold capitalize text-muted-foreground">
                      {format(new Date(day + "T12:00:00"), "EEEE d 'de' MMMM", { locale: es })}
                    </p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {daySlots.map((s, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            setSelectedSlot(s);
                            setStep(3);
                          }}
                          className="rounded-lg border border-border px-2 py-1.5 text-left text-xs transition-smooth hover:border-primary hover:bg-primary/5"
                        >
                          <p className="font-semibold">{format(s.startsAt, "HH:mm")}</p>
                          <p className="text-[10px] text-muted-foreground">{s.courtName}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </ScrollArea>
            <Button variant="ghost" onClick={() => setStep(1)} className="w-full">
              ← Volver
            </Button>
          </div>
        )}

        {step === 3 && selectedSlot && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-muted/30 p-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Resumen
              </p>
              <p className="mt-2 font-display text-lg font-semibold">
                {coach.profile?.first_name} {coach.profile?.last_name}
              </p>
              <div className="mt-2 space-y-1 text-sm">
                <p className="flex items-center gap-2">
                  <CalIcon className="h-4 w-4 text-primary" />
                  {format(selectedSlot.startsAt, "EEEE d 'de' MMMM, HH:mm", { locale: es })}
                </p>
                <p className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  {selectedSlot.durationMin} min · {selectedSlot.courtName}
                </p>
                <p className="flex items-center gap-2">
                  {kind === "socio_individual" ? (
                    <UserIcon className="h-4 w-4 text-primary" />
                  ) : (
                    <Users className="h-4 w-4 text-primary" />
                  )}
                  Clase {kind === "socio_individual" ? "individual" : "compartida"}
                </p>
                {kind === "socio_compartida" && partnerName && (
                  <p className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    Con {partnerName}
                  </p>
                )}
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                <span className="text-sm text-muted-foreground">Total</span>
                <span className="font-display text-xl font-semibold">
                  ${totalPrice.toLocaleString("es-CL")}
                </span>
              </div>
              {kind === "socio_compartida" && (
                <Badge variant="secondary" className="mt-2">
                  Pagas tu parte. Avisa al 2° alumno.
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button variant="ghost" onClick={() => setStep(2)}>
                ← Cambiar
              </Button>
              <Button
                variant="clay"
                onClick={() => createClass.mutate(selectedSlot)}
                disabled={createClass.isPending}
              >
                {createClass.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Confirmar"
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
