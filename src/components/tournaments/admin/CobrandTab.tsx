import { useEffect, useMemo, useState } from "react";
import { Loader2, Trash2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import {
  COBRAND_REGISTRY,
  buildGradient,
  contrastRatio,
  sanitizePlain,
} from "@/lib/cobrand-registry";
import { useTournamentCobrand } from "@/hooks/useTournamentCobrand";
import { CobrandHero } from "@/components/tournaments/cobrand/CobrandHero";
import { StreamSettingsSection } from "./StreamSettingsSection";
import { haptic } from "@/lib/feedback/haptic";

interface Props {
  tournamentId: string;
  tournamentName: string;
}

interface FormState {
  brand_key: string;
  display_name: string;
  eyebrow_text: string;
  lockup_text: string;
  flag_country: string;
  logo_url: string;
  rights_text: string;
  primary_hex: string;
  accent_hex: string;
}

const EMPTY: FormState = {
  brand_key: "custom",
  display_name: "",
  eyebrow_text: "",
  lockup_text: "",
  flag_country: "fr",
  logo_url: "",
  rights_text: "",
  primary_hex: "#14213D",
  accent_hex: "#C8102E",
};

const COUNTRIES: { code: string; label: string }[] = [
  { code: "fr", label: "Francia" },
  { code: "cl", label: "Chile" },
  { code: "ar", label: "Argentina" },
  { code: "es", label: "España" },
  { code: "it", label: "Italia" },
];

export function CobrandTab({ tournamentId, tournamentName }: Props) {
  const { cobrand, loading } = useTournamentCobrand(tournamentId);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Hidrata el form cuando llega el cobrand de la BD
  useEffect(() => {
    if (cobrand) {
      setForm({
        brand_key: cobrand.brand_key,
        display_name: cobrand.display_name,
        eyebrow_text: cobrand.eyebrow_text ?? "",
        lockup_text: cobrand.lockup_text ?? "",
        flag_country: cobrand.flag_country ?? "fr",
        logo_url: cobrand.logo_url ?? "",
        rights_text: cobrand.rights_text ?? "",
        primary_hex: cobrand.primary_hex ?? "#14213D",
        accent_hex: cobrand.accent_hex ?? "#C8102E",
      });
    }
  }, [cobrand?.tournament_id]);

  const gradient = useMemo(
    () => buildGradient(form.primary_hex, form.accent_hex),
    [form.primary_hex, form.accent_hex],
  );

  const contrast = useMemo(
    () => contrastRatio("#ffffff", form.primary_hex),
    [form.primary_hex],
  );
  const contrastOk = contrast >= 4.5;

  const applyPreset = (key: string) => {
    if (key === "custom") {
      setForm((prev) => ({ ...prev, brand_key: "custom" }));
      return;
    }
    const preset = COBRAND_REGISTRY[key];
    if (!preset) return;
    setForm({
      brand_key: preset.brand_key,
      display_name: preset.display_name,
      eyebrow_text: preset.eyebrow_text,
      lockup_text: preset.lockup_text,
      flag_country: preset.flag_country,
      logo_url: preset.logo_url ?? "",
      rights_text: preset.rights_text ?? "",
      primary_hex: preset.primary_hex,
      accent_hex: preset.accent_hex,
    });
  };

  const handleSave = async () => {
    if (!form.display_name.trim()) {
      toast({ title: "Falta el nombre del sponsor", variant: "destructive" });
      return;
    }
    setSaving(true);
    haptic("medium");
    const { error } = await supabase.from("tournament_cobrand").upsert(
      {
        tournament_id: tournamentId,
        brand_key: form.brand_key || "custom",
        display_name: form.display_name.trim(),
        eyebrow_text: sanitizePlain(form.eyebrow_text),
        lockup_text: sanitizePlain(form.lockup_text),
        flag_country: form.flag_country || null,
        logo_url: form.logo_url.trim() || null,
        rights_text: sanitizePlain(form.rights_text),
        primary_hex: form.primary_hex,
        accent_hex: form.accent_hex,
        gradient_css: gradient,
      },
      { onConflict: "tournament_id" },
    );
    setSaving(false);
    if (error) {
      toast({ title: "No se pudo guardar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Co-marca guardada" });
  };

  const handleDelete = async () => {
    setDeleting(true);
    haptic("heavy");
    const { error } = await supabase
      .from("tournament_cobrand")
      .delete()
      .eq("tournament_id", tournamentId);
    setDeleting(false);
    if (error) {
      toast({ title: "No se pudo eliminar", description: error.message, variant: "destructive" });
      return;
    }
    setForm(EMPTY);
    toast({ title: "Co-marca eliminada" });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-muted-foreground">
          Co-marca · sponsor del torneo
        </p>
        <p className="text-sm text-muted-foreground">
          Si este torneo tiene un sponsor (club, marca o federación), su identidad reemplazará el hero
          y aparecerá en cards. Sin co-marca, todo se ve con el branding AcePlay default.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
        >
          <div>
            <Label htmlFor="preset">Preset</Label>
            <Select value={form.brand_key} onValueChange={applyPreset}>
              <SelectTrigger id="preset">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.values(COBRAND_REGISTRY).map((p) => (
                  <SelectItem key={p.brand_key} value={p.brand_key}>
                    {p.display_name}
                  </SelectItem>
                ))}
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="display_name">Nombre del sponsor *</Label>
            <Input
              id="display_name"
              value={form.display_name}
              onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
              placeholder="Stade Français"
              maxLength={60}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="flag">Bandera</Label>
              <Select
                value={form.flag_country}
                onValueChange={(v) => setForm((f) => ({ ...f, flag_country: v }))}
              >
                <SelectTrigger id="flag">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="lockup">Lockup</Label>
              <Input
                id="lockup"
                value={form.lockup_text}
                onChange={(e) => setForm((f) => ({ ...f, lockup_text: e.target.value }))}
                placeholder="ACEPLAY × STADE FRANÇAIS"
                maxLength={80}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="eyebrow">Eyebrow</Label>
            <Input
              id="eyebrow"
              value={form.eyebrow_text}
              onChange={(e) => setForm((f) => ({ ...f, eyebrow_text: e.target.value }))}
              placeholder="Te invita Stade Français"
              maxLength={120}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="primary">Color primario</Label>
              <div className="flex gap-2">
                <Input
                  id="primary"
                  type="color"
                  value={form.primary_hex}
                  onChange={(e) => setForm((f) => ({ ...f, primary_hex: e.target.value }))}
                  className="h-10 w-14 p-1"
                />
                <Input
                  value={form.primary_hex}
                  onChange={(e) => setForm((f) => ({ ...f, primary_hex: e.target.value }))}
                  className="flex-1 font-mono text-xs"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="accent">Color acento</Label>
              <div className="flex gap-2">
                <Input
                  id="accent"
                  type="color"
                  value={form.accent_hex}
                  onChange={(e) => setForm((f) => ({ ...f, accent_hex: e.target.value }))}
                  className="h-10 w-14 p-1"
                />
                <Input
                  value={form.accent_hex}
                  onChange={(e) => setForm((f) => ({ ...f, accent_hex: e.target.value }))}
                  className="flex-1 font-mono text-xs"
                />
              </div>
            </div>
          </div>

          {!contrastOk && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                Contraste {contrast.toFixed(2)}:1 — el texto blanco no cumple AA (mínimo 4.5).
                Considera oscurecer el color primario.
              </span>
            </div>
          )}

          <div>
            <Label htmlFor="logo_url">URL del logo del sponsor</Label>
            <Input
              id="logo_url"
              value={form.logo_url}
              onChange={(e) => setForm((f) => ({ ...f, logo_url: e.target.value }))}
              placeholder="https://… (SVG o PNG)"
            />
            <p className="mt-1 text-[10px] text-muted-foreground">
              Pega una URL pública. Recomendado: SVG o PNG transparente.
            </p>
          </div>

          <div>
            <Label htmlFor="rights">Texto de derechos / reglamento</Label>
            <Textarea
              id="rights"
              value={form.rights_text}
              onChange={(e) => setForm((f) => ({ ...f, rights_text: e.target.value }))}
              placeholder="Stade Français es sponsor oficial — usa el material institucional…"
              rows={3}
              maxLength={500}
            />
          </div>

          <div className="flex items-center gap-2">
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              {cobrand ? "Guardar cambios" : "Activar co-marca"}
            </Button>
            {cobrand && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="outline" disabled={deleting}>
                    <Trash2 className="mr-2 h-3.5 w-3.5" />
                    Quitar co-marca
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Quitar co-marca?</AlertDialogTitle>
                    <AlertDialogDescription>
                      El torneo volverá al branding AcePlay default. Puedes volver a activarla cuando
                      quieras.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Quitar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </form>

        <div className="space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-muted-foreground">
            Preview
          </p>
          <div className="overflow-hidden rounded-2xl border">
            <CobrandHero
              cobrand={{
                tournament_id: tournamentId,
                brand_key: form.brand_key,
                display_name: form.display_name || "Sponsor",
                eyebrow_text: form.eyebrow_text || null,
                lockup_text: form.lockup_text || null,
                flag_country: form.flag_country || null,
                logo_url: form.logo_url || null,
                rights_text: form.rights_text || null,
                primary_hex: form.primary_hex,
                accent_hex: form.accent_hex,
                gradient_css: gradient,
                created_at: "",
                updated_at: "",
              }}
            >
              <h1 className="mt-3 font-display text-2xl font-semibold leading-tight">
                {tournamentName}
              </h1>
              <p className="mt-1 text-[12px] opacity-85">
                Vista previa del hero con la co-marca configurada.
              </p>
            </CobrandHero>
          </div>

          {form.logo_url && (
            <div className="rounded-xl border p-3">
              <p className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                Logo
              </p>
              <img
                src={form.logo_url}
                alt={`Logo ${form.display_name}`}
                className="max-h-16 max-w-full object-contain"
              />
            </div>
          )}
        </div>
      </div>

      <StreamSettingsSection tournamentId={tournamentId} />
    </div>
  );
}