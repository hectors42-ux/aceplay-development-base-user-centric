import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9_]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");

export default function Onboarding() {
  const { user, profile, onboarded, refreshProfile } = useAuth();
  const nav = useNavigate();
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [handleError, setHandleError] = useState<string | null>(null);
  const [terms, setTerms] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [brand, setBrand] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    document.title = "Completa tu perfil · AcePlay";
  }, []);

  useEffect(() => {
    if (onboarded) nav("/", { replace: true });
  }, [onboarded, nav]);

  useEffect(() => {
    if (profile) {
      setHandle(profile.handle ?? "");
      setDisplayName(profile.display_name ?? "");
    }
  }, [profile]);

  const checkHandle = async (value: string) => {
    const clean = slugify(value);
    setHandle(clean);
    if (clean.length < 3) {
      setHandleError("Mínimo 3 caracteres.");
      return;
    }
    const { data } = await supabase.from("profiles").select("id").eq("handle", clean).maybeSingle();
    if (data && data.id !== user?.id) {
      setHandleError("Ese handle ya está tomado.");
    } else {
      setHandleError(null);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (handleError || handle.length < 3 || !displayName || !terms) {
      toast.error("Completa los campos requeridos.");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        handle,
        display_name: displayName,
        data_consent: {
          onboarded: true,
          terms: true,
          analytics,
          brand_targeting: brand,
          accepted_at: new Date().toISOString(),
        },
      })
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await refreshProfile();
    nav("/", { replace: true });
  };

  return (
    <main className="relative flex min-h-screen items-start justify-center overflow-hidden bg-background px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 50% 0%, hsl(var(--primary)/0.15), transparent 60%)",
        }}
      />
      <Card className="relative w-full max-w-md border-border/70 bg-card/95 shadow-xl backdrop-blur">
        <CardHeader>
          <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-primary">
            Paso final
          </p>
          <CardTitle className="mt-1 font-display text-3xl leading-tight">
            Crea tu identidad
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Te acompañará en cada club, torneo y escalerilla.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="handle">Handle</Label>
              <Input
                id="handle"
                value={handle}
                onChange={(e) => checkHandle(e.target.value)}
                onBlur={(e) => checkHandle(e.target.value)}
                placeholder="tu_nombre"
              />
              {handleError && <p className="text-xs text-destructive">{handleError}</p>}
              <p className="text-xs text-muted-foreground">minúsculas, sin espacios.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="display">Nombre a mostrar</Label>
              <Input
                id="display"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Cómo te llaman en cancha"
                required
              />
            </div>

            <div className="space-y-3 rounded-lg border border-border bg-muted/40 p-3">
              <p className="text-xs font-medium text-foreground">Consentimientos (Ley 21.719)</p>
              <label className="flex items-start gap-3 text-sm">
                <Checkbox checked={terms} onCheckedChange={(v) => setTerms(v === true)} className="mt-0.5" />
                <span>
                  Acepto los términos y el tratamiento básico de mis datos para participar en competencias.
                </span>
              </label>
              <label className="flex items-start gap-3 text-sm">
                <Checkbox checked={analytics} onCheckedChange={(v) => setAnalytics(v === true)} className="mt-0.5" />
                <span>Analítica opcional para mejorar AcePlay.</span>
              </label>
              <label className="flex items-start gap-3 text-sm">
                <Checkbox checked={brand} onCheckedChange={(v) => setBrand(v === true)} className="mt-0.5" />
                <span>Permitir uso anonimizado para campañas de marcas patrocinadoras.</span>
              </label>
            </div>

            <Button type="submit" disabled={saving} className="w-full">
              {saving ? "Guardando…" : "Listo, entrar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}