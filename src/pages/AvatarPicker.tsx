import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Camera, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/avatar/UserAvatar";
import { RallyAvatar, RALLY_LOOKS, RALLY_LOOK_LABEL, type RallyLook } from "@/components/avatar/RallyAvatar";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const isMinor = (birthdate: string | null | undefined) => {
  if (!birthdate) return false;
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 18);
  return new Date(birthdate) > cutoff;
};

const AvatarPicker = () => {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const minor = isMinor(profile?.birthdate);
  const name = `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim();

  const saveLook = async (look: RallyLook) => {
    if (!user) return;
    setBusy(look);
    const { error } = await supabase.from("profiles")
      .update({ avatar_kind: "rally", avatar_look: look }).eq("id", user.id);
    if (!error) await refreshProfile();
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success(`Look "${RALLY_LOOK_LABEL[look]}" aplicado.`);
  };

  const onPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Máximo 5 MB."); return; }
    setBusy("photo");
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const up = await supabase.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type });
    if (up.error) { setBusy(null); toast.error(up.error.message); return; }
    const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
    const { error } = await supabase.from("profiles")
      .update({ avatar_kind: "photo", avatar_url: pub.publicUrl }).eq("id", user.id);
    if (!error) await refreshProfile();
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Foto actualizada.");
  };

  return (
    <div className="mx-auto max-w-md px-5 py-6">
      <div className="mb-5 flex items-center gap-3">
        <Link to="/perfil" className="flex h-9 w-9 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Perfil</p>
          <h1 className="font-display text-xl font-semibold">Tu avatar</h1>
        </div>
      </div>

      {/* Avatar actual */}
      <div className="mb-6 flex items-center gap-4 rounded-3xl border border-border bg-card p-4 shadow-card">
        <UserAvatar kind={profile?.avatar_kind} look={profile?.avatar_look} url={profile?.avatar_url} name={name} className="h-16 w-16" />
        <div>
          <p className="font-display text-base font-semibold">{name || "Tu avatar"}</p>
          <p className="text-xs text-muted-foreground">
            {profile?.avatar_kind === "photo" ? "Usando tu foto" : `Mascota Rally · ${RALLY_LOOK_LABEL[(profile?.avatar_look as RallyLook) ?? "classic"]}`}
          </p>
        </div>
      </div>

      {/* Foto (oculta para menores: Ley 21.719) */}
      {!minor ? (
        <div className="mb-6">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Tu foto</p>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPhoto} />
          <Button variant="outline" className="w-full" disabled={busy === "photo"} onClick={() => fileRef.current?.click()}>
            {busy === "photo" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            Subir una foto
          </Button>
        </div>
      ) : (
        <p className="mb-6 rounded-2xl border border-dashed border-border bg-card p-3 text-center text-xs text-muted-foreground">
          Las cuentas de menores usan la mascota Rally (sin foto) por privacidad.
        </p>
      )}

      {/* Looks de Rally */}
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Mascota Rally</p>
      <div className="grid grid-cols-3 gap-3">
        {RALLY_LOOKS.map((look) => {
          const active = profile?.avatar_kind === "rally" && profile?.avatar_look === look;
          return (
            <button key={look} type="button" disabled={!!busy} onClick={() => saveLook(look as RallyLook)}
              className={cn("relative flex flex-col items-center gap-1.5 rounded-2xl border p-3 transition-smooth",
                active ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border hover:bg-muted")}>
              <span className="h-14 w-14"><RallyAvatar look={look} /></span>
              <span className="text-[11px] font-medium text-muted-foreground">{RALLY_LOOK_LABEL[look]}</span>
              {active && <Check className="absolute right-2 top-2 h-4 w-4 text-primary" />}
              {busy === look && <Loader2 className="absolute right-2 top-2 h-4 w-4 animate-spin text-primary" />}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default AvatarPicker;
