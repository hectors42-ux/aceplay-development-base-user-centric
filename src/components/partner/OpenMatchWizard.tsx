import { useMemo, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { PartnerPicker } from "@/components/PartnerPicker";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import { useActiveSport } from "@/components/providers/SportProvider";
import { useToast } from "@/hooks/use-toast";
import { useMyRating } from "@/hooks/useMyRating";
import { cn } from "@/lib/utils";
import { Check, ChevronLeft, ChevronRight, Clock, User, Users, UsersRound } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const TIMES = ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "19:00", "20:00", "21:00"];

const buildDays = () => {
  const days: { iso: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    d.setHours(0, 0, 0, 0);
    days.push({
      iso: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString("es-CL", { weekday: "short", day: "numeric", month: "short" }),
    });
  }
  return days;
};

const FORMATS_TENIS = [
  { value: "1set" as const, label: "1 set", hint: "Rápido (~45 min)" },
  { value: "best_of_3" as const, label: "Mejor de 3", hint: "Estándar (~1h30)" },
  { value: "best_of_5" as const, label: "Mejor de 5", hint: "Largo (~2h30)" },
];

const FORMATS_PADEL = [
  { value: "1set" as const, label: "1 set", hint: "Rápido (~45 min)" },
  { value: "best_of_3" as const, label: "Mejor de 3", hint: "Estándar (~1h30)" },
];

const GENDERS = [
  { value: "any" as const, label: "Cualquiera" },
  { value: "male" as const, label: "Hombres" },
  { value: "female" as const, label: "Mujeres" },
  { value: "mixed" as const, label: "Mixto" },
];

const Stepper = ({ step }: { step: number }) => (
  <div className="flex items-center justify-center gap-2">
    {[1, 2, 3].map((n) => (
      <div
        key={n}
        className={cn(
          "h-1.5 w-8 rounded-full transition-all",
          n <= step ? "bg-primary" : "bg-muted",
        )}
      />
    ))}
  </div>
);

export const OpenMatchWizard = ({ open, onClose, onSuccess }: Props) => {
  const { user, profile } = useAuth();
  const { sport } = useActiveSport();
  const { rating } = useMyRating();
  const { toast } = useToast();

  const isPadel = sport === "padel";
  const FORMATS = isPadel ? FORMATS_PADEL : FORMATS_TENIS;

  const days = useMemo(buildDays, []);
  const [step, setStep] = useState(1);
  const [slots, setSlots] = useState<string[]>([]);
  // Para pádel forzamos doubles; para tenis arrancamos en singles
  const [matchType, setMatchType] = useState<"singles" | "doubles">(isPadel ? "doubles" : "singles");
  const [mode, setMode] = useState<"open_slots" | "pair_vs_pair">("open_slots");
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [format, setFormat] = useState<"1set" | "best_of_3" | "best_of_5">("best_of_3");
  const myLevel = rating?.level ? Number(rating.level) : 3.5;
  const [levelRange, setLevelRange] = useState<[number, number]>([
    Math.max(1, myLevel - 0.5),
    Math.min(7, myLevel + 0.5),
  ]);
  const [gender, setGender] = useState<"any" | "male" | "female" | "mixed">("any");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setStep(1);
    setSlots([]);
    setMatchType(isPadel ? "doubles" : "singles");
    setMode("open_slots");
    setPartnerId(null);
    setFormat("best_of_3");
    setGender("any");
    setNote("");
  };

  const toggleSlot = (date: string, time: string) => {
    const iso = new Date(`${date}T${time}:00`).toISOString();
    setSlots((s) => (s.includes(iso) ? s.filter((x) => x !== iso) : [...s, iso]));
  };

  const needsPartner = matchType === "doubles" && mode === "pair_vs_pair";
  const canNext =
    step === 1
      ? slots.length > 0
      : step === 2
      ? !!format && !!matchType && (!needsPartner || !!partnerId)
      : true;

  const submit = async () => {
    if (!user || !profile?.tenant_id) return;
    setSubmitting(true);
    const slotsTotal = matchType === "singles" ? 2 : 4;
    const { error } = await supabase.from("match_open_posts").insert({
      user_id: user.id,
      tenant_id: profile.tenant_id,
      format,
      available_slots: slots.map((iso) => ({ starts_at: iso })),
      note: note || null,
      match_type: matchType,
      mode: matchType === "singles" ? "open_slots" : mode,
      slots_total: slotsTotal,
      sport,
      gender_filter: gender,
      level_min: levelRange[0],
      level_max: levelRange[1],
      partner_user_id: needsPartner ? partnerId : null,
    } as never);
    setSubmitting(false);
    if (error) {
      toast({ title: "No se pudo publicar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Reto abierto publicado", description: "Visible 48h para tu club." });
    onSuccess?.();
    reset();
    onClose();
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent
        className="p-0 gap-0 max-w-2xl w-full sm:rounded-2xl flex flex-col h-[100dvh] sm:h-auto sm:max-h-[90vh] overflow-hidden"
      >
        {/* Header */}
        <div className="border-b border-border bg-[hsl(var(--ink-dark))] px-5 py-4 text-[hsl(var(--cream-0))]">
          <div className="flex items-center justify-between">
            <button
              onClick={step === 1 ? handleClose : () => setStep(step - 1)}
              className="text-[hsl(var(--cream-0))]/70 hover:text-[hsl(var(--cream-0))]"
            >
              {step === 1 ? "Cerrar" : <ChevronLeft className="h-5 w-5" />}
            </button>
            <h2 className="font-display text-base font-semibold">Reto abierto</h2>
            <span className="text-[11px] text-[hsl(var(--cream-0))]/60">Paso {step}/3</span>
          </div>
          <div className="mt-3">
            <Stepper step={step} />
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {step === 1 && (
            <div>
              <p className="font-display text-lg font-semibold">¿Cuándo te acomoda?</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Selecciona uno o varios horarios. Tu reto será visible 48h.
              </p>
              <div className="mt-4 space-y-3">
                {days.map((d) => (
                  <div key={d.iso}>
                    <p className="mb-1.5 text-[11px] font-medium capitalize text-foreground">{d.label}</p>
                    <div className="grid grid-cols-5 gap-1.5">
                      {TIMES.map((t) => {
                        const iso = new Date(`${d.iso}T${t}:00`).toISOString();
                        const past = new Date(iso).getTime() < Date.now();
                        const active = slots.includes(iso);
                        return (
                          <button
                            key={t}
                            type="button"
                            disabled={past}
                            onClick={() => toggleSlot(d.iso, t)}
                            className={cn(
                              "rounded-lg border px-1 py-1.5 text-xs font-medium transition-smooth",
                              past && "opacity-25 cursor-not-allowed",
                              active
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border bg-background hover:bg-muted",
                            )}
                          >
                            {t}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div>
                <p className="font-display text-lg font-semibold">Tipo y formato</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {isPadel
                    ? "Pádel siempre se juega en dobles."
                    : "Elige cómo quieres jugar y a quién esperas enfrentar."}
                </p>
              </div>

              {/* Match type — solo tenis muestra opción */}
              {!isPadel && (
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Modalidad
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setMatchType("singles");
                        setMode("open_slots");
                        setPartnerId(null);
                      }}
                      className={cn(
                        "flex flex-col items-center gap-1 rounded-2xl border-2 p-3 transition-smooth",
                        matchType === "singles"
                          ? "border-primary bg-primary/5"
                          : "border-border bg-card hover:border-primary/30",
                      )}
                    >
                      <User className="h-5 w-5 text-primary" />
                      <span className="font-display text-sm font-semibold">Singles</span>
                      <span className="text-[10px] text-muted-foreground">1 vs 1</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMatchType("doubles")}
                      className={cn(
                        "flex flex-col items-center gap-1 rounded-2xl border-2 p-3 transition-smooth",
                        matchType === "doubles"
                          ? "border-primary bg-primary/5"
                          : "border-border bg-card hover:border-primary/30",
                      )}
                    >
                      <Users className="h-5 w-5 text-primary" />
                      <span className="font-display text-sm font-semibold">Dobles</span>
                      <span className="text-[10px] text-muted-foreground">2 vs 2</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Mode (solo dobles) */}
              {matchType === "doubles" && (
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Cómo se arman los equipos
                  </p>
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => {
                        setMode("open_slots");
                        setPartnerId(null);
                      }}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-2xl border-2 px-3 py-2.5 text-left transition-smooth",
                        mode === "open_slots"
                          ? "border-primary bg-primary/5"
                          : "border-border bg-card hover:border-primary/30",
                      )}
                    >
                      <UsersRound className="h-5 w-5 text-primary" />
                      <div className="flex-1">
                        <p className="font-display text-sm font-semibold">Cupos abiertos</p>
                        <p className="text-[10px] text-muted-foreground">
                          3 jugadores se suman uno por uno
                        </p>
                      </div>
                      {mode === "open_slots" && <Check className="h-4 w-4 text-primary" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode("pair_vs_pair")}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-2xl border-2 px-3 py-2.5 text-left transition-smooth",
                        mode === "pair_vs_pair"
                          ? "border-primary bg-primary/5"
                          : "border-border bg-card hover:border-primary/30",
                      )}
                    >
                      <Users className="h-5 w-5 text-primary" />
                      <div className="flex-1">
                        <p className="font-display text-sm font-semibold">Yo y mi pareja vs pareja</p>
                        <p className="text-[10px] text-muted-foreground">
                          Eliges tu compañero/a y esperas otra pareja
                        </p>
                      </div>
                      {mode === "pair_vs_pair" && <Check className="h-4 w-4 text-primary" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Partner picker */}
              {needsPartner && (
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Mi pareja
                  </p>
                  <PartnerPicker value={partnerId} onChange={(id) => setPartnerId(id)} />
                </div>
              )}

              {/* Format */}
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Formato
                </p>
                <div className="space-y-2">
                  {FORMATS.map((f) => (
                    <button
                      key={f.value}
                      type="button"
                      onClick={() => setFormat(f.value)}
                      className={cn(
                        "flex w-full items-center justify-between rounded-2xl border-2 px-4 py-2.5 text-left transition-smooth",
                        format === f.value
                          ? "border-primary bg-primary/5"
                          : "border-border bg-card hover:border-primary/30",
                      )}
                    >
                      <div>
                        <p className="font-display text-sm font-semibold">{f.label}</p>
                        <p className="text-[11px] text-muted-foreground">{f.hint}</p>
                      </div>
                      {format === f.value && <Check className="h-5 w-5 text-primary" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <div>
                <p className="font-display text-lg font-semibold">Filtros y nota</p>
                <p className="mt-1 text-xs text-muted-foreground">Opcionales — para acotar quién se puede unir.</p>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Nivel rival
                  </p>
                  <span className="text-xs font-medium text-primary">
                    {levelRange[0].toFixed(1)} – {levelRange[1].toFixed(1)}
                  </span>
                </div>
                <div className="mt-3 px-1">
                  <Slider
                    value={levelRange}
                    onValueChange={(v) => setLevelRange([v[0], v[1]] as [number, number])}
                    min={1}
                    max={7}
                    step={0.1}
                    minStepsBetweenThumbs={1}
                  />
                </div>
              </div>

              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Género
                </p>
                <div className="grid grid-cols-4 gap-1.5">
                  {GENDERS.map((g) => (
                    <button
                      key={g.value}
                      type="button"
                      onClick={() => setGender(g.value)}
                      className={cn(
                        "rounded-lg border px-2 py-2 text-xs font-medium transition-smooth",
                        gender === g.value
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background hover:bg-muted",
                      )}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Nota (opcional)
                </p>
                <Textarea
                  placeholder="Busco partido competitivo, set largo o tiebreak…"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  maxLength={140}
                />
              </div>

              {/* Resumen */}
              <div className="rounded-2xl border border-border bg-muted/30 p-3 text-xs">
                <p className="mb-1 flex items-center gap-1 font-semibold">
                  <Clock className="h-3 w-3" /> {slots.length} horario{slots.length === 1 ? "" : "s"}
                </p>
                <p className="text-muted-foreground">
                  {matchType === "singles"
                    ? "Singles"
                    : mode === "pair_vs_pair"
                    ? "Dobles · Pareja vs pareja"
                    : "Dobles · Cupos abiertos"}{" "}
                  · {FORMATS.find((f) => f.value === format)?.label}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border bg-background px-5 py-3">
          {step < 3 ? (
            <Button
              variant="clay"
              size="lg"
              className="w-full"
              disabled={!canNext}
              onClick={() => setStep(step + 1)}
            >
              Siguiente <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <Button
              variant="clay"
              size="lg"
              className="w-full"
              disabled={submitting}
              onClick={submit}
            >
              {submitting ? "Publicando…" : "Publicar reto"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
