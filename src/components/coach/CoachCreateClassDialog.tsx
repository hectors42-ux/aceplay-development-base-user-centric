import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Loader2, Calendar as CalIcon, Users, User as UserIcon, Phone, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCoachSlots } from "@/hooks/useCoachSlots";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PartnerPicker } from "@/components/PartnerPicker";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Coach {
  id: string;
  hourly_rate_member_clp: number;
  hourly_rate_shared_clp: number;
  hourly_rate_external_clp: number;
}

interface Props {
  coach: Coach | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Mode = "externa" | "socio_individual" | "socio_compartida";

export const CoachCreateClassDialog = ({ coach, open, onOpenChange }: Props) => {
  const qc = useQueryClient();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [mode, setMode] = useState<Mode>("externa");
  const [duration, setDuration] = useState<60 | 120>(60);
  const [extName, setExtName] = useState("");
  const [extPhone, setExtPhone] = useState("");
  const [s1, setS1] = useState<string | null>(null);
  const [s1Name, setS1Name] = useState<string | null>(null);
  const [s2, setS2] = useState<string | null>(null);
  const [s2Name, setS2Name] = useState<string | null>(null);
  const [slot, setSlot] = useState<{
    startsAt: Date;
    endsAt: Date;
    courtId: string;
    courtName: string;
  } | null>(null);

  const { slots } = useCoachSlots({
    coachId: coach?.id ?? null,
    duration,
    externalOnly: mode === "externa",
    enabled: open && step >= 2,
  });

  const reset = () => {
    setStep(1);
    setMode("externa");
    setDuration(60);
    setExtName("");
    setExtPhone("");
    setS1(null);
    setS1Name(null);
    setS2(null);
    setS2Name(null);
    setSlot(null);
  };

  const create = useMutation({
    mutationFn: async () => {
      if (!coach || !slot) throw new Error("Falta seleccionar horario");
      const { data, error } = await supabase.rpc("create_coach_class", {
        _coach_id: coach.id,
        _court_id: slot.courtId,
        _starts_at: slot.startsAt.toISOString(),
        _duration_minutes: duration,
        _kind: mode,
        _student1_user_id: mode === "externa" ? null : s1,
        _student2_user_id: mode === "socio_compartida" ? s2 : null,
        _external_student_name: mode === "externa" ? extName.trim() : null,
        _external_student_phone: mode === "externa" ? extPhone.trim() || null : null,
        _notes: null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Clase creada y confirmada");
      qc.invalidateQueries({ queryKey: ["my-coach-classes"] });
      qc.invalidateQueries({ queryKey: ["coach-upcoming-classes"] });
      onOpenChange(false);
      reset();
    },
    onError: (e: Error) => toast.error(e.message ?? "No se pudo crear la clase"),
  });

  const slotsByDay = slots.reduce<Record<string, typeof slots>>((acc, s) => {
    const k = format(s.startsAt, "yyyy-MM-dd");
    (acc[k] ||= []).push(s);
    return acc;
  }, {});

  const price =
    mode === "externa"
      ? coach?.hourly_rate_external_clp ?? 0
      : mode === "socio_compartida"
        ? coach?.hourly_rate_shared_clp ?? 0
        : coach?.hourly_rate_member_clp ?? 0;
  const total = duration === 120 ? price * 2 : price;

  const canAdvance =
    mode === "externa"
      ? extName.trim().length >= 2
      : mode === "socio_individual"
        ? !!s1
        : !!s1 && !!s2 && s1 !== s2;

  if (!coach) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Nueva clase</DialogTitle>
          <DialogDescription>
            Paso {step} de 3 ·{" "}
            {step === 1 ? "Tipo de alumno" : step === 2 ? "Horario" : "Confirmar"}
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="externa">Externo</TabsTrigger>
                <TabsTrigger value="socio_individual">Socio</TabsTrigger>
                <TabsTrigger value="socio_compartida">2 socios</TabsTrigger>
              </TabsList>
            </Tabs>

            {mode === "externa" && (
              <div className="space-y-3">
                <div>
                  <Label htmlFor="ext-name" className="text-xs uppercase tracking-wider text-muted-foreground">
                    Nombre del alumno externo *
                  </Label>
                  <Input
                    id="ext-name"
                    value={extName}
                    onChange={(e) => setExtName(e.target.value)}
                    placeholder="Ej. Juan Pérez"
                    maxLength={80}
                    className="mt-1 h-11 rounded-2xl"
                  />
                </div>
                <div>
                  <Label htmlFor="ext-phone" className="text-xs uppercase tracking-wider text-muted-foreground">
                    Teléfono (opcional)
                  </Label>
                  <div className="relative mt-1">
                    <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="ext-phone"
                      value={extPhone}
                      onChange={(e) => setExtPhone(e.target.value)}
                      placeholder="+56 9…"
                      maxLength={20}
                      className="h-11 rounded-2xl pl-9"
                    />
                  </div>
                </div>
              </div>
            )}

            {mode === "socio_individual" && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Alumno (socio)
                </p>
                <PartnerPicker
                  value={s1}
                  onChange={(id, m) => {
                    setS1(id);
                    setS1Name(m ? `${m.first_name} ${m.last_name}` : null);
                  }}
                />
              </div>
            )}

            {mode === "socio_compartida" && (
              <div className="space-y-3">
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    1° socio
                  </p>
                  <PartnerPicker
                    value={s1}
                    onChange={(id, m) => {
                      setS1(id);
                      setS1Name(m ? `${m.first_name} ${m.last_name}` : null);
                    }}
                  />
                </div>
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    2° socio
                  </p>
                  <PartnerPicker
                    value={s2}
                    onChange={(id, m) => {
                      setS2(id);
                      setS2Name(m ? `${m.first_name} ${m.last_name}` : null);
                    }}
                    excludeUserId={s1 ?? undefined}
                  />
                </div>
              </div>
            )}

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Duración
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[60, 120].map((d) => (
                  <button
                    key={d}
                    onClick={() => setDuration(d as 60 | 120)}
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
              variant="clay"
              className="w-full"
              disabled={!canAdvance}
              onClick={() => setStep(2)}
            >
              Ver horarios
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
                            setSlot(s);
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

        {step === 3 && slot && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-muted/30 p-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Resumen</p>
              <p className="mt-2 font-display text-lg font-semibold">
                {mode === "externa"
                  ? extName
                  : mode === "socio_individual"
                    ? s1Name
                    : `${s1Name} + ${s2Name}`}
              </p>
              <div className="mt-2 space-y-1 text-sm">
                <p className="flex items-center gap-2">
                  <CalIcon className="h-4 w-4 text-primary" />
                  {format(slot.startsAt, "EEEE d 'de' MMMM, HH:mm", { locale: es })}
                </p>
                <p className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  {duration} min · {slot.courtName}
                </p>
                <p className="flex items-center gap-2">
                  {mode === "socio_compartida" ? (
                    <Users className="h-4 w-4 text-primary" />
                  ) : (
                    <UserIcon className="h-4 w-4 text-primary" />
                  )}
                  {mode === "externa"
                    ? "Clase externa"
                    : mode === "socio_individual"
                      ? "Clase individual"
                      : "Clase compartida"}
                </p>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                <span className="text-sm text-muted-foreground">Total</span>
                <span className="font-display text-xl font-semibold">
                  ${total.toLocaleString("es-CL")}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button variant="ghost" onClick={() => setStep(2)}>
                ← Cambiar
              </Button>
              <Button
                variant="clay"
                onClick={() => create.mutate()}
                disabled={create.isPending}
              >
                {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crear clase"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
