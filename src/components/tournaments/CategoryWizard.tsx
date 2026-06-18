import { useEffect, useMemo, useState } from "react";
import { Loader2, Settings2, RotateCcw, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { toast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";
import { GENDER_LABEL, type CategoryGender } from "@/lib/tournament-utils";
import {
  PRESETS_BY_KEY,
  parseEventDefaults,
  type CompetitionMotor,
  type EventDefaults,
  type PresetKey,
  type PresetKnobs,
  type TournamentModality,
  type TournamentSport,
} from "@/lib/tournament-presets";
import { Switch } from "@/components/ui/switch";
import { DEFAULT_PROFILE, type ScoringProfile } from "@/lib/scoring-profile";
import { Stepper } from "./wizard/Stepper";
import { FormatPicker } from "./wizard/FormatPicker";
import { WizardSummary } from "./wizard/WizardSummary";
import { CreateSuccessCheck } from "./wizard/CreateSuccessCheck";
import { HapticButton } from "@/components/feedback/HapticButton";
import { haptic } from "@/lib/feedback/haptic";

type Tournament = Tables<"tournaments">;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tournament: Tournament | null;
  onSaved: () => void;
}

type Step = "identity" | "format" | "rules" | "summary";
const STEP_ORDER: Step[] = ["identity", "format", "rules", "summary"];

const SCORING_LABEL: Record<PresetKnobs["scoring"], string> = {
  sets_2_de_3: "2 sets de 3",
  sets_1_de_3: "1 set",
  pro_set_8: "Pro set a 8",
  tiebreak_10: "Tiebreak a 10",
};
const SCHEDULING_LABEL: Record<PresetKnobs["schedulingMode"], string> = {
  fechas_fijas: "Fechas fijas",
  acuerdo_jugadores: "Acuerdo entre jugadores",
  rondas_semanales: "Rondas semanales",
};
const CLOSE_LABEL: Record<PresetKnobs["closeMode"], string> = {
  automatico_al_completar: "Automático al completarse",
  manual: "Manual (admin cierra)",
};

export const CategoryWizard = ({ open, onOpenChange, tournament, onSaved }: Props) => {
  const { profile } = useAuth();
  const [step, setStep] = useState<Step>("identity");
  const [submitting, setSubmitting] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const eventDefaults: EventDefaults = useMemo(
    () =>
      parseEventDefaults(
        (tournament as unknown as { default_config?: unknown } | null)?.default_config,
      ),
    [tournament],
  );

  // Identidad
  const [name, setName] = useState("Singles A");
  const [gender, setGender] = useState<CategoryGender>("varones");
  const [maxParticipants, setMaxParticipants] = useState(32);
  const [sport, setSport] = useState<TournamentSport>("tenis");
  const [modality, setModality] = useState<TournamentModality>("singles");

  // Formato
  const [presetKey, setPresetKey] = useState<PresetKey>("eliminacion_simple");
  const [knobs, setKnobs] = useState<PresetKnobs>(PRESETS_BY_KEY.eliminacion_simple.defaults);

  // Reglas operativas (override de categoría)
  const [cuotaClp, setCuotaClp] = useState<string>("");
  const [cuotaOverridden, setCuotaOverridden] = useState(false);
  const [premios, setPremios] = useState<string>("");
  const [premiosOverridden, setPremiosOverridden] = useState(false);

  // Perfil de scoring (PRD 8) — vive en config.scoring
  const [scoringProfile, setScoringProfile] = useState<ScoringProfile>(DEFAULT_PROFILE);

  // PRD 9 — Cierre y reglas operativas (columnas dedicadas)
  const [closeMode, setCloseMode] = useState<"bracket" | "deadline" | "fixture" | "continuo">("bracket");
  const [deadlineAt, setDeadlineAt] = useState<string>("");
  const [dominantRule, setDominantRule] = useState(false);
  const [bottomNTail, setBottomNTail] = useState<number>(0);
  const [resumeWindowDays, setResumeWindowDays] = useState<number>(7);
  // PRD 10 — Americano (rotación): cantidad de rondas planificadas (opcional)
  const [americanoRoundsTarget, setAmericanoRoundsTarget] = useState<number>(5);

  useEffect(() => {
    if (!open) return;
    setStep("identity");
    setAdvancedOpen(false);
    setName("Singles A");
    setGender("varones");
    setMaxParticipants(32);

    const inheritedSport: TournamentSport = eventDefaults.sport ?? "tenis";
    const inheritedModality: TournamentModality =
      inheritedSport === "padel" ? "dobles" : (eventDefaults.modality ?? "singles");
    setSport(inheritedSport);
    setModality(inheritedModality);

    const inheritedPreset: PresetKey = eventDefaults.presetKey ?? "eliminacion_simple";
    const safePreset: PresetKey = PRESETS_BY_KEY[inheritedPreset]?.available
      ? inheritedPreset
      : "eliminacion_simple";
    setPresetKey(safePreset);
    setKnobs({ ...PRESETS_BY_KEY[safePreset].defaults, ...(eventDefaults.knobs ?? {}) });

    setCuotaClp(eventDefaults.cuotaClp != null ? String(eventDefaults.cuotaClp) : "");
    setCuotaOverridden(false);
    setPremios(eventDefaults.premios ?? "");
    setPremiosOverridden(false);
    setScoringProfile(DEFAULT_PROFILE);
    setCloseMode("bracket");
    setDeadlineAt("");
    setDominantRule(false);
    setBottomNTail(0);
    setResumeWindowDays(7);
    setAmericanoRoundsTarget(5);
    setShowSuccess(false);
  }, [open, eventDefaults]);

  // Pádel siempre dobles.
  useEffect(() => {
    if (sport === "padel" && modality !== "dobles") setModality("dobles");
  }, [sport, modality]);

  const choosePreset = (key: PresetKey) => {
    const def = PRESETS_BY_KEY[key];
    if (!def.available && key !== "personalizado") return;
    setPresetKey(key);
    setKnobs(def.defaults);
  };

  const updateKnob = <K extends keyof PresetKnobs>(k: K, v: PresetKnobs[K]) => {
    setKnobs((prev) => ({ ...prev, [k]: v }));
    // Cualquier cambio manual rompe el preset → personalizado
    if (presetKey !== "personalizado") setPresetKey("personalizado");
  };

  const handleSubmit = async () => {
    if (!profile || !tournament) return;
    if (!name.trim()) {
      toast({ title: "Falta el nombre", variant: "destructive" });
      setStep("identity");
      return;
    }
    setSubmitting(true);

    const effectiveModality: TournamentModality = sport === "padel" ? "dobles" : modality;
    const motor: CompetitionMotor = knobs.motor;

    // config jsonb: solo lo que difiere del evento o lo que el usuario eligió explícitamente
    const config: Record<string, unknown> = {
      knobs, // siempre persistimos las 5 perillas resueltas
      scoring: scoringProfile, // PRD 8
    };
    if (cuotaOverridden && cuotaClp.trim() !== "") {
      const n = Math.max(0, Math.round(Number(cuotaClp)));
      if (Number.isFinite(n)) config.cuotaClp = n;
    }
    if (premiosOverridden && premios.trim() !== "") {
      config.premios = premios.trim();
    }

    // Mapeo agendamiento round_robin: el knob existente → campo `scheduling` de BD
    const schedulingMap: Record<PresetKnobs["schedulingMode"], string> = {
      acuerdo_jugadores: "desafio_libre",
      rondas_semanales: "admin",
      fechas_fijas: "fixture_auto",
    };
    const rrScheduling = motor === "round_robin" ? schedulingMap[knobs.schedulingMode] : undefined;

    const { error } = await supabase.from("tournament_categories").insert({
      tournament_id: tournament.id,
      tenant_id: profile.tenant_id,
      name,
      category_label: name,
      gender,
      max_participants: maxParticipants,
      sport,
      modality: effectiveModality,
      motor,
      preset_key: presetKey,
      ...(rrScheduling ? { scheduling: rrScheduling } : {}),
      close_mode: closeMode,
      deadline_at: closeMode === "deadline" && deadlineAt ? new Date(deadlineAt).toISOString() : null,
      entry_fee_clp: cuotaOverridden && cuotaClp.trim() !== "" ? Math.max(0, Math.round(Number(cuotaClp)) || 0) : 0,
      ...(knobs.motor === "americano_rotacion" && americanoRoundsTarget > 0
        ? { americano_rounds_target: americanoRoundsTarget }
        : {}),
      operational_rules: {
        dominant_rule: dominantRule,
        bottom_n_tail: bottomNTail,
        resume_window_days: resumeWindowDays,
      } as never,
      config: config as unknown as never,
    });
    setSubmitting(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    haptic("success");
    setShowSuccess(true);
    toast({ title: "Categoría creada", description: PRESETS_BY_KEY[presetKey].label });
    setTimeout(() => {
      setShowSuccess(false);
      onOpenChange(false);
      onSaved();
    }, 900);
  };

  const stepIndex = STEP_ORDER.indexOf(step);
  const next = () => {
    const i = STEP_ORDER.indexOf(step);
    if (i < STEP_ORDER.length - 1) {
      haptic("light");
      setStep(STEP_ORDER[i + 1]);
    }
  };
  const back = () => {
    const i = STEP_ORDER.indexOf(step);
    if (i > 0) setStep(STEP_ORDER[i - 1]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nueva categoría</DialogTitle>
        </DialogHeader>

        <Stepper active={stepIndex} />

        {showSuccess && <CreateSuccessCheck label="¡Categoría creada!" />}

        <Tabs value={step} onValueChange={(v) => setStep(v as Step)} className="w-full">
          <TabsList className="sr-only">
            <TabsTrigger value="identity">Disciplina</TabsTrigger>
            <TabsTrigger value="format">Formato</TabsTrigger>
            <TabsTrigger value="rules">Reglas</TabsTrigger>
            <TabsTrigger value="summary">Listo</TabsTrigger>
          </TabsList>

          {/* PASO 1 — Identidad y disciplina */}
          <TabsContent value="identity" className="max-h-[70vh] space-y-3 overflow-y-auto py-3 pr-1">
            <div>
              <Label htmlFor="c-name">Nombre</Label>
              <Input id="c-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Singles A" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Deporte</Label>
                <Select value={sport} onValueChange={(v) => setSport(v as TournamentSport)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tenis">Tenis</SelectItem>
                    <SelectItem value="padel">Pádel</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="flex items-center gap-2">
                  Modalidad
                  {sport === "padel" && (
                    <Badge variant="secondary" className="text-[10px]">Regla del deporte</Badge>
                  )}
                </Label>
                <Select
                  value={sport === "padel" ? "dobles" : modality}
                  onValueChange={(v) => setModality(v as TournamentModality)}
                  disabled={sport === "padel"}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="singles">Singles</SelectItem>
                    <SelectItem value="dobles">Dobles</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Género</Label>
                <Select value={gender} onValueChange={(v) => setGender(v as CategoryGender)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(GENDER_LABEL) as CategoryGender[]).map((g) => (
                      <SelectItem key={g} value={g}>{GENDER_LABEL[g]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="c-max">Cupo máximo</Label>
                <Input
                  id="c-max"
                  type="number"
                  min={2}
                  max={128}
                  value={maxParticipants}
                  onChange={(e) => setMaxParticipants(Number(e.target.value))}
                />
              </div>
            </div>
          </TabsContent>

          {/* PASO 2 — Formato (presets) + avanzado colapsado */}
          <TabsContent value="format" className="max-h-[70vh] space-y-3 overflow-y-auto py-3 pr-1">
            <FormatPicker
              value={presetKey}
              onChange={choosePreset}
              sport={sport}
              suggestedKey={eventDefaults.presetKey ?? undefined}
            />

            {knobs.motor === "americano_rotacion" && (
              <div className="rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-3">
                <Label htmlFor="rounds-target" className="text-xs uppercase tracking-wider text-muted-foreground">
                  Rondas planificadas (americano)
                </Label>
                <Input
                  id="rounds-target"
                  type="number"
                  min={1}
                  max={20}
                  value={americanoRoundsTarget}
                  onChange={(e) =>
                    setAmericanoRoundsTarget(Math.max(1, Math.min(20, Number(e.target.value) || 1)))
                  }
                  className="mt-1 max-w-[120px]"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  La inscripción es individual. Cada ronda recompone parejas evitando repetir compañero.
                </p>
              </div>
            )}

            <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2 px-2">
                  <Settings2 className="h-4 w-4" />
                  Ajuste avanzado {advancedOpen ? "▲" : "▼"}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 space-y-3 rounded-2xl border border-dashed border-border bg-muted/20 p-3">
                <p className="text-[11px] text-muted-foreground">
                  Solo si querés cambiar el comportamiento por defecto. Cualquier cambio aquí marca el preset como "personalizado".
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Scoring</Label>
                    <Select value={knobs.scoring} onValueChange={(v) => updateKnob("scoring", v as PresetKnobs["scoring"])}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(SCORING_LABEL) as PresetKnobs["scoring"][]).map((s) => (
                          <SelectItem key={s} value={s}>{SCORING_LABEL[s]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Mejor de N</Label>
                    <Input
                      type="number"
                      min={1}
                      max={5}
                      value={knobs.bestOf}
                      onChange={(e) => updateKnob("bestOf", Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <Label>Agendamiento</Label>
                    <Select value={knobs.schedulingMode} onValueChange={(v) => updateKnob("schedulingMode", v as PresetKnobs["schedulingMode"])}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(SCHEDULING_LABEL) as PresetKnobs["schedulingMode"][]).map((s) => (
                          <SelectItem key={s} value={s}>{SCHEDULING_LABEL[s]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Cierre</Label>
                    <Select value={knobs.closeMode} onValueChange={(v) => updateKnob("closeMode", v as PresetKnobs["closeMode"])}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(CLOSE_LABEL) as PresetKnobs["closeMode"][]).map((s) => (
                          <SelectItem key={s} value={s}>{CLOSE_LABEL[s]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="mt-3 space-y-2 rounded-xl border border-dashed border-border/60 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Perfil de scoring
                  </p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <div>
                      <Label>Sets</Label>
                      <Select
                        value={String(scoringProfile.sets)}
                        onValueChange={(v) =>
                          setScoringProfile((p) => ({ ...p, sets: Number(v) as 1 | 3 | 5 }))
                        }
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 set</SelectItem>
                          <SelectItem value="3">Al mejor de 3</SelectItem>
                          <SelectItem value="5">Al mejor de 5</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Juegos por set</Label>
                      <Select
                        value={String(scoringProfile.games_per_set)}
                        onValueChange={(v) =>
                          setScoringProfile((p) => ({
                            ...p,
                            games_per_set: Number(v) as 4 | 6 | 9,
                          }))
                        }
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="4">A 4</SelectItem>
                          <SelectItem value="6">A 6</SelectItem>
                          <SelectItem value="9">Pro-set a 9</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Tie-break del set</Label>
                      <Select
                        value={scoringProfile.set_tb}
                        onValueChange={(v) =>
                          setScoringProfile((p) => ({
                            ...p,
                            set_tb: v as ScoringProfile["set_tb"],
                          }))
                        }
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="tb7">TB a 7</SelectItem>
                          <SelectItem value="tb7_dif2">TB a 7 (dif. 2)</SelectItem>
                          <SelectItem value="ventaja">Por ventaja</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Set final</Label>
                      <Select
                        value={scoringProfile.final_set}
                        onValueChange={(v) =>
                          setScoringProfile((p) => ({
                            ...p,
                            final_set: v as ScoringProfile["final_set"],
                          }))
                        }
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="normal">Set normal</SelectItem>
                          <SelectItem value="super_tb10">Súper TB a 10</SelectItem>
                          <SelectItem value="ventaja">Por ventaja</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Gana por</Label>
                      <Select
                        value={scoringProfile.win_by}
                        onValueChange={(v) =>
                          setScoringProfile((p) => ({
                            ...p,
                            win_by: v as ScoringProfile["win_by"],
                          }))
                        }
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sets">Sets</SelectItem>
                          <SelectItem value="games">Juegos totales (pozo)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Terminación</Label>
                      <Select
                        value={scoringProfile.termination}
                        onValueChange={(v) =>
                          setScoringProfile((p) => ({
                            ...p,
                            termination: v as ScoringProfile["termination"],
                          }))
                        }
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="score">Por marcador</SelectItem>
                          <SelectItem value="time">Por tiempo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <label className="flex items-center justify-between gap-2 pt-1">
                    <span className="text-xs">Golden point (40-40 muerte súbita)</span>
                    <Switch
                      checked={scoringProfile.golden_point}
                      onCheckedChange={(checked) =>
                        setScoringProfile((p) => ({ ...p, golden_point: checked }))
                      }
                    />
                  </label>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </TabsContent>

          {/* PASO 3 — Reglas operativas heredadas */}
          <TabsContent value="rules" className="max-h-[70vh] space-y-3 overflow-y-auto py-3 pr-1">
            <InheritedField
              label="Cuota (CLP)"
              inheritedValue={eventDefaults.cuotaClp != null ? String(eventDefaults.cuotaClp) : ""}
              overridden={cuotaOverridden}
              value={cuotaClp}
              onChange={(v) => { setCuotaClp(v); setCuotaOverridden(true); }}
              onReinherit={() => {
                setCuotaClp(eventDefaults.cuotaClp != null ? String(eventDefaults.cuotaClp) : "");
                setCuotaOverridden(false);
              }}
              inputType="number"
              placeholder="0"
            />
            <InheritedField
              label="Premios"
              inheritedValue={eventDefaults.premios ?? ""}
              overridden={premiosOverridden}
              value={premios}
              onChange={(v) => { setPremios(v); setPremiosOverridden(true); }}
              onReinherit={() => {
                setPremios(eventDefaults.premios ?? "");
                setPremiosOverridden(false);
              }}
              placeholder="Trofeo + gift card"
            />

            <div className="rounded-xl border border-dashed border-border/60 p-3 space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Cierre y reglas operativas
              </p>
              <div>
                <Label>Modo de cierre</Label>
                <Select value={closeMode} onValueChange={(v) => setCloseMode(v as typeof closeMode)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bracket">Bracket (final del cuadro)</SelectItem>
                    <SelectItem value="deadline">Por deadline (fecha límite)</SelectItem>
                    <SelectItem value="fixture">Al completar fixture</SelectItem>
                    <SelectItem value="continuo">Continuo (no cierra)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {closeMode === "deadline" && (
                <div>
                  <Label>Fecha y hora límite</Label>
                  <Input
                    type="datetime-local"
                    value={deadlineAt}
                    onChange={(e) => setDeadlineAt(e.target.value)}
                  />
                </div>
              )}
              <label className="flex items-center justify-between gap-2">
                <span className="text-xs">Regla del jugador dominante</span>
                <Switch checked={dominantRule} onCheckedChange={setDominantRule} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Zona de cola (N últimos)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={10}
                    value={bottomNTail}
                    onChange={(e) => setBottomNTail(Math.max(0, Math.min(10, Number(e.target.value) || 0)))}
                  />
                </div>
                <div>
                  <Label>Ventana reanudación (días)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={60}
                    value={resumeWindowDays}
                    onChange={(e) => setResumeWindowDays(Math.max(1, Math.min(60, Number(e.target.value) || 7)))}
                  />
                </div>
              </div>
            </div>
          </TabsContent>

          {/* PASO 4 — Resumen del cuadro */}
          <TabsContent value="summary" className="max-h-[70vh] space-y-3 overflow-y-auto py-3 pr-1">
            <WizardSummary
              name={name}
              sport={sport}
              modality={sport === "padel" ? "dobles" : modality}
              maxParticipants={maxParticipants}
              presetKey={presetKey}
              knobs={knobs}
              scoring={scoringProfile}
              cuotaClp={cuotaClp}
              cuotaOverridden={cuotaOverridden}
              premios={premios}
              premiosOverridden={premiosOverridden}
              americanoRoundsTarget={americanoRoundsTarget}
            />
            <p className="text-center text-[11px] text-muted-foreground">~58s para crear · podés volver atrás a ajustar.</p>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          {step !== "identity" && (
            <Button variant="ghost" onClick={back}>Atrás</Button>
          )}
          {step !== "summary" ? (
            <Button onClick={next}>Continuar</Button>
          ) : (
            <HapticButton
              level="heavy"
              onClick={handleSubmit}
              disabled={submitting || !name}
              className="shimmer-host inline-flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground shadow-clay transition-smooth hover:brightness-110 disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Zap className="h-4 w-4" />
              )}
              Crear cuadro
            </HapticButton>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

interface InheritedFieldProps {
  label: string;
  inheritedValue: string;
  overridden: boolean;
  value: string;
  onChange: (v: string) => void;
  onReinherit: () => void;
  inputType?: "text" | "number";
  placeholder?: string;
}

const InheritedField = ({
  label,
  inheritedValue,
  overridden,
  value,
  onChange,
  onReinherit,
  inputType = "text",
  placeholder,
}: InheritedFieldProps) => (
  <div>
    <div className="flex items-center justify-between gap-2">
      <Label>{label}</Label>
      {overridden ? (
        <Badge variant="default" className="text-[10px]">Propio de la categoría</Badge>
      ) : (
        <Badge variant="secondary" className="text-[10px]">Heredado del evento</Badge>
      )}
    </div>
    <div className="flex items-center gap-2">
      <Input
        type={inputType}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? (inheritedValue || "—")}
        className="flex-1"
      />
      {overridden && (
        <Button type="button" size="icon" variant="ghost" onClick={onReinherit} title="Volver a heredar del evento">
          <RotateCcw className="h-4 w-4" />
        </Button>
      )}
    </div>
  </div>
);