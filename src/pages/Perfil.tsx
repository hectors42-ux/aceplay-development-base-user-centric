import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export default function Perfil() {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const nav = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [analytics, setAnalytics] = useState(false);
  const [brand, setBrand] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    document.title = "Perfil · AcePlay";
  }, []);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name);
      setAvatarUrl(profile.avatar_url ?? "");
      const c = (profile.data_consent ?? {}) as Record<string, unknown>;
      setAnalytics(Boolean(c["analytics"]));
      setBrand(Boolean(c["brand_targeting"]));
    }
  }, [profile]);

  if (!user || !profile) return null;

  const saveBasics = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName, avatar_url: avatarUrl || null })
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await refreshProfile();
    toast.success("Perfil actualizado");
  };

  const savePrivacy = async (key: "analytics" | "brand_targeting", value: boolean) => {
    const next = { ...(profile.data_consent ?? {}), [key]: value };
    const { error } = await supabase
      .from("profiles")
      .update({ data_consent: next as never })
      .eq("id", user.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await refreshProfile();
  };

  const onSignOut = async () => {
    await signOut();
    nav("/login", { replace: true });
  };

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-primary/15 bg-gradient-to-br from-primary/10 via-card to-card p-5 shadow-sm">
        <div className="flex items-center gap-4">
          <Avatar className="h-20 w-20 ring-2 ring-primary/30">
            {avatarUrl && <AvatarImage src={avatarUrl} />}
            <AvatarFallback className="bg-primary/10 font-display text-xl text-primary">
              {(displayName || profile.handle).slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-primary">Perfil</p>
            <h1 className="mt-1 font-display text-2xl leading-tight">{displayName || profile.handle}</h1>
            <p className="truncate text-xs text-muted-foreground">@{profile.handle} · {user.email}</p>
          </div>
        </div>
      </section>

      <Card>
        <CardContent className="space-y-4 p-4">
          <p className="font-display text-lg">Tus datos</p>
          <div className="space-y-1.5">
            <Label htmlFor="display">Nombre a mostrar</Label>
            <Input id="display" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="avatar">Avatar (URL)</Label>
            <Input
              id="avatar"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://…"
            />
          </div>
          <Button onClick={saveBasics} disabled={saving} className="rounded-full">
            {saving ? "Guardando…" : "Guardar cambios"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div>
            <p className="font-display text-lg">Privacidad</p>
            <p className="text-xs text-muted-foreground">
              Controla cómo se usan tus datos. Ley 21.719.
            </p>
          </div>
          <label className="flex items-start gap-3 text-sm">
            <Checkbox
              checked={analytics}
              onCheckedChange={(v) => {
                const next = v === true;
                setAnalytics(next);
                savePrivacy("analytics", next);
              }}
              className="mt-0.5"
            />
            <span>Analítica opcional para mejorar AcePlay.</span>
          </label>
          <label className="flex items-start gap-3 text-sm">
            <Checkbox
              checked={brand}
              onCheckedChange={(v) => {
                const next = v === true;
                setBrand(next);
                savePrivacy("brand_targeting", next);
              }}
              className="mt-0.5"
            />
            <span>Uso anonimizado para campañas de marcas patrocinadoras.</span>
          </label>
        </CardContent>
      </Card>

      <Button variant="outline" className="w-full rounded-full" onClick={onSignOut}>
        Cerrar sesión
      </Button>
    </div>
  );
}