import { useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import {
  VALIDATION_MODE_LABEL,
  slugify,
  type ResultValidationMode,
} from "@/lib/tournament-utils";
import {
  TOURNAMENT_PRESETS,
  type EventDefaults,
  type PresetKey,
  type TournamentModality,
  type TournamentSport,
  parseEventDefaults,
} from "@/lib/tournament-presets";
import type { Tables } from "@/integrations/supabase/types";

type Tournament = Tables<"tournaments">;

interface TournamentFormDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: "create" | "edit";
  tournament?: Tournament | null;
  onSaved: () => void;
}

/** Convierte un ISO a formato compatible con input[type=datetime-local] respetando timezone local. */
function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const TournamentFormDialog = ({
  open,
  onOpenChange,
  mode,
  tournament,
  onSaved,
}: TournamentFormDialogProps) => {
  const { profile, user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<"identity" | "defaults">("identity");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [validationMode, setValidationMode] =
    useState<ResultValidationMode>("jugadores_con_confirmacion");
  const [rescheduleEnabled, setRescheduleEnabled] = useState(true);
  const [rescheduleWindow, setRescheduleWindow] = useState(48);
  const [rescheduleNotice, setRescheduleNotice] = useState(12);
  const [regOpens, setRegOpens] = useState("");
  const [regCloses, setRegCloses] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");

  // Defaults del evento (heredados por sus categorías)
  const [defSport, setDefSport] = useState<TournamentSport>("tenis");
  const [defModality, setDefModality] = useState<TournamentModality>("singles");
  const [defPreset, setDefPreset] = useState<PresetKey>("eliminacion_simple");
  const [defCuotaClp, setDefCuotaClp] = useState<string>("");
  const [defPremios, setDefPremios] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    setStep("identity");
    if (mode === "edit" && tournament) {
      setName(tournament.name);
      setDescription(tournament.description ?? "");
      setValidationMode(tournament.result_validation_mode);
      setRescheduleEnabled(tournament.reschedule_enabled);
      setRescheduleWindow(tournament.reschedule_window_hours);
      setRescheduleNotice(tournament.reschedule_min_notice_hours);
      setRegOpens(isoToLocalInput(tournament.registration_opens_at));
      setRegCloses(isoToLocalInput(tournament.registration_closes_at));
      setStartsAt(isoToLocalInput(tournament.starts_at));
      setEndsAt(isoToLocalInput(tournament.ends_at));
      const dc = parseEventDefaults((tournament as unknown as { default_config?: unknown }).default_config);
      setDefSport(dc.sport ?? "tenis");
      setDefModality(dc.modality ?? "singles");
      setDefPreset(dc.presetKey ?? "eliminacion_simple");
      setDefCuotaClp(dc.cuotaClp != null ? String(dc.cuotaClp) : "");
      setDefPremios(dc.premios ?? "");
    } else if (mode === "create") {
      setName("");
      setDescription("");
      setValidationMode("jugadores_con_confirmacion");
      setRescheduleEnabled(true);
      setRescheduleWindow(48);
      setRescheduleNotice(12);
      setRegOpens("");
      setRegCloses("");
      setStartsAt("");
      setEndsAt("");
      setDefSport("tenis");
      setDefModality("singles");
      setDefPreset("eliminacion_simple");
      setDefCuotaClp("");
      setDefPremios("");
    }
  }, [open, mode, tournament]);

  // Pádel siempre fuerza dobles (regla del deporte, reflejada en BD).
  useEffect(() => {
    if (defSport === "padel" && defModality !== "dobles") {
      setDefModality("dobles");
    }
  }, [defSport, defModality]);

  const buildDefaultConfig = (): EventDefaults => {
    const dc: EventDefaults = {
      sport: defSport,
      modality: defSport === "padel" ? "dobles" : defModality,
      presetKey: defPreset,
    };
    if (defCuotaClp.trim() !== "") {
      const n = Math.max(0, Math.round(Number(defCuotaClp)));
      if (Number.isFinite(n)) dc.cuotaClp = n;
    }
    if (defPremios.trim() !== "") dc.premios = defPremios.trim();
    return dc;
  };

  const handleSubmit = async () => {
    if (!profile || !user) return;
    if (!name || !regOpens || !regCloses || !startsAt || !endsAt) {
      toast({ title: "Completa todos los campos", variant: "destructive" });
      setStep("identity");
      return;
    }
    setSubmitting(true);
    const default_config = buildDefaultConfig();
    if (mode === "create") {
      const { error } = await supabase.from("tournaments").insert({
        tenant_id: profile.tenant_id,
        name,
        slug: `${slugify(name)}-${Math.random().toString(36).slice(2, 6)}`,
        description: description || null,
        result_validation_mode: validationMode,
        reschedule_enabled: rescheduleEnabled,
        reschedule_window_hours: rescheduleWindow,
        reschedule_min_notice_hours: rescheduleNotice,
        registration_opens_at: new Date(regOpens).toISOString(),
        registration_closes_at: new Date(regCloses).toISOString(),
        starts_at: new Date(startsAt).toISOString(),
        ends_at: new Date(endsAt).toISOString(),
        status: "borrador",
        created_by: user.id,
        default_config: default_config as unknown as never,
      });
      setSubmitting(false);
      if (error) {
        toast({ title: "Error al crear", description: error.message, variant: "destructive" });
        return;
      }
      toast({
        title: "Torneo creado",
        description: "Ahora agrégale categorías (Singles A, B, Damas…).",
      });
    } else {
      if (!tournament) {
        setSubmitting(false);
        return;
      }
      const { error } = await supabase
        .from("tournaments")
        .update({
          name,
          description: description || null,
          result_validation_mode: validationMode,
          reschedule_enabled: rescheduleEnabled,
          reschedule_window_hours: rescheduleWindow,
          reschedule_min_notice_hours: rescheduleNotice,
          registration_opens_at: new Date(regOpens).toISOString(),
          registration_closes_at: new Date(regCloses).toISOString(),
          starts_at: new Date(startsAt).toISOString(),
          ends_at: new Date(endsAt).toISOString(),
          default_config: default_config as unknown as never,
        })
        .eq("id", tournament.id);
      setSubmitting(false);
      if (error) {
        toast({ title: "Error al guardar", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Cambios guardados" });
    }
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Nuevo torneo (evento)" : "Editar torneo"}
          </DialogTitle>
        </DialogHeader>
        <Tabs value={step} onValueChange={(v) => setStep(v as "identity" | "defaults")} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="identity">1 · Identidad</TabsTrigger>
            <TabsTrigger value="defaults">2 · Defaults del evento</TabsTrigger>
          </TabsList>

          <TabsContent value="identity" className="max-h-[70vh] space-y-3 overflow-y-auto py-3 pr-1">
            <div>
            <Label htmlFor="t-name">Nombre del evento</Label>
            <Input
              id="t-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Apertura 2026"
            />
          </div>
          <div>
            <Label htmlFor="t-desc">Descripción</Label>
            <Textarea
              id="t-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div>
            <Label>Quién carga los resultados</Label>
            <Select
              value={validationMode}
              onValueChange={(v) => setValidationMode(v as ResultValidationMode)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(VALIDATION_MODE_LABEL) as ResultValidationMode[]).map((m) => (
                  <SelectItem key={m} value={m}>
                    {VALIDATION_MODE_LABEL[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-border bg-muted/30 px-3 py-2">
            <div>
              <Label className="cursor-pointer">Reagendamiento entre jugadores</Label>
              <p className="text-xs text-muted-foreground">
                Acuerdo entre rivales sin pasar por admin
              </p>
            </div>
            <Switch checked={rescheduleEnabled} onCheckedChange={setRescheduleEnabled} />
          </div>

          {rescheduleEnabled && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="t-rw">Ventana (horas)</Label>
                <Input
                  id="t-rw"
                  type="number"
                  min={1}
                  value={rescheduleWindow}
                  onChange={(e) => setRescheduleWindow(Number(e.target.value))}
                />
              </div>
              <div>
                <Label htmlFor="t-rn">Anticipación mínima (horas)</Label>
                <Input
                  id="t-rn"
                  type="number"
                  min={0}
                  value={rescheduleNotice}
                  onChange={(e) => setRescheduleNotice(Number(e.target.value))}
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="t-ro">Inscripciones desde</Label>
              <Input
                id="t-ro"
                type="datetime-local"
                value={regOpens}
                onChange={(e) => setRegOpens(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="t-rc">Inscripciones hasta</Label>
              <Input
                id="t-rc"
                type="datetime-local"
                value={regCloses}
                onChange={(e) => setRegCloses(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="t-sa">Inicio del torneo</Label>
              <Input
                id="t-sa"
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="t-ea">Fin del torneo</Label>
              <Input
                id="t-ea"
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
              />
            </div>
          </div>
          </TabsContent>

          <TabsContent value="defaults" className="max-h-[70vh] space-y-4 overflow-y-auto py-3 pr-1">
            <p className="text-xs text-muted-foreground">
              Estos defaults se heredan a cada categoría que crees. Podés sobreescribirlos por categoría.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Deporte por defecto</Label>
                <Select value={defSport} onValueChange={(v) => setDefSport(v as TournamentSport)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tenis">Tenis</SelectItem>
                    <SelectItem value="padel">Pádel</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Modalidad por defecto</Label>
                <Select
                  value={defSport === "padel" ? "dobles" : defModality}
                  onValueChange={(v) => setDefModality(v as TournamentModality)}
                  disabled={defSport === "padel"}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="singles">Singles</SelectItem>
                    <SelectItem value="dobles">Dobles</SelectItem>
                  </SelectContent>
                </Select>
                {defSport === "padel" && (
                  <p className="mt-1 text-[11px] text-muted-foreground">Pádel siempre es dobles.</p>
                )}
              </div>
            </div>

            <div>
              <Label className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-primary" /> Preset sugerido
              </Label>
              <p className="mb-2 text-[11px] text-muted-foreground">
                Las categorías nuevas nacerán con este preset preseleccionado.
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {TOURNAMENT_PRESETS.filter((p) => p.key !== "personalizado").map((p) => {
                  const selected = defPreset === p.key;
                  const disabled = !p.available;
                  return (
                    <button
                      key={p.key}
                      type="button"
                      disabled={disabled}
                      onClick={() => setDefPreset(p.key)}
                      className={`rounded-2xl border p-3 text-left transition ${
                        selected
                          ? "border-primary bg-primary/5"
                          : "border-border bg-card hover:border-primary/40"
                      } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">{p.label}</span>
                        {!p.available && (
                          <Badge variant="secondary" className="text-[10px]">Próximamente</Badge>
                        )}
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground">{p.helper}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="t-cuota">Cuota por categoría (CLP)</Label>
                <Input
                  id="t-cuota"
                  type="number"
                  min={0}
                  step={1000}
                  inputMode="numeric"
                  value={defCuotaClp}
                  onChange={(e) => setDefCuotaClp(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div>
                <Label htmlFor="t-prem">Premios</Label>
                <Input
                  id="t-prem"
                  value={defPremios}
                  onChange={(e) => setDefPremios(e.target.value)}
                  placeholder="Trofeo + gift card $30.000"
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Cuota y premios viven en la configuración del evento. Cada categoría los hereda y puede sobreescribirlos.
            </p>
          </TabsContent>
        </Tabs>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          {step === "identity" ? (
            <Button onClick={() => setStep("defaults")}>Continuar</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setStep("identity")}>Atrás</Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {mode === "create" ? "Crear evento" : "Guardar cambios"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
