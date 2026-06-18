import { useState, useRef } from "react";
import { Loader2, Upload, Mail, Phone } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type UserProfile } from "@/components/providers/AuthProvider";
import { compressImage } from "@/lib/image-utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";

interface ExtProfile extends UserProfile {
  bio?: string | null;
  dominant_hand?: "right" | "left" | "ambi" | null;
  backhand?: "one_handed" | "two_handed" | null;
  favorite_shot?: string | null;
  favorite_surface?: string | null;
  playing_style?: string | null;
  availability?: string | null;
  years_playing?: number | null;
  show_phone?: boolean | null;
  show_email?: boolean | null;
  padel_position?: string | null;
  padel_dominant_side?: string | null;
  preferred_sport?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: ExtProfile;
  onSaved: () => void;
}

const schema = z.object({
  first_name: z.string().trim().min(1, "Requerido").max(60),
  last_name: z.string().trim().min(1, "Requerido").max(60),
  phone: z
    .string()
    .trim()
    .max(30)
    .regex(/^[+0-9 ()-]*$/, "Solo números, espacios y +()-")
    .optional()
    .or(z.literal("")),
  bio: z.string().trim().max(280).optional().or(z.literal("")),
  favorite_shot: z.string().trim().max(60).optional().or(z.literal("")),
  playing_style: z.string().trim().max(60).optional().or(z.literal("")),
  availability: z.string().trim().max(120).optional().or(z.literal("")),
  years_playing: z.coerce.number().int().min(0).max(80).optional(),
});

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
    {children}
  </h3>
);

export const ProfileEditDialog = ({ open, onOpenChange, profile, onSaved }: Props) => {
  const { user, refreshProfile } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    first_name: profile.first_name ?? "",
    last_name: profile.last_name ?? "",
    phone: profile.phone ?? "",
    bio: profile.bio ?? "",
    dominant_hand: profile.dominant_hand ?? "right",
    backhand: profile.backhand ?? "two_handed",
    favorite_shot: profile.favorite_shot ?? "",
    favorite_surface: profile.favorite_surface ?? "arcilla",
    playing_style: profile.playing_style ?? "",
    availability: profile.availability ?? "",
    years_playing: profile.years_playing?.toString() ?? "",
    show_phone: profile.show_phone ?? false,
    show_email: profile.show_email ?? false,
    padel_position: profile.padel_position ?? "",
    padel_dominant_side: profile.padel_dominant_side ?? "",
  });
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url);

  const handleAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Archivo inválido", description: "Sube una imagen.", variant: "destructive" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "Imagen muy grande", description: "Máx. 10MB antes de comprimir.", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const compressed = await compressImage(file, { maxSize: 800, quality: 0.85 });
      const path = `${user.id}/avatar-${Date.now()}.jpg`;

      const { error } = await supabase.storage.from("avatars").upload(path, compressed, {
        cacheControl: "31536000",
        upsert: false,
        contentType: "image/jpeg",
      });
      if (error) throw error;

      // Borrar avatar anterior en background (no bloquear UX)
      if (avatarUrl?.includes("/avatars/")) {
        const prevPath = avatarUrl.split("/avatars/")[1]?.split("?")[0];
        if (prevPath && prevPath.startsWith(`${user.id}/`)) {
          void supabase.storage.from("avatars").remove([prevPath]);
        }
      }

      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      setAvatarUrl(pub.publicUrl);

      // Optimista: persistir avatar y refrescar contexto para que home lo
      // muestre sin esperar a "Guardar".
      const { error: updErr } = await supabase
        .from("profiles")
        .update({ avatar_url: pub.publicUrl })
        .eq("user_id", user.id);
      if (updErr) throw updErr;
      await refreshProfile();

      toast({ title: "Foto actualizada" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      toast({ title: "Error subiendo foto", description: msg, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleSave = async () => {
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast({
        title: "Datos inválidos",
        description: parsed.error.errors[0]?.message ?? "Revisa los campos",
        variant: "destructive",
      });
      return;
    }
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        first_name: parsed.data.first_name,
        last_name: parsed.data.last_name,
        phone: parsed.data.phone || null,
        bio: parsed.data.bio || null,
        dominant_hand: form.dominant_hand,
        backhand: form.backhand,
        favorite_shot: parsed.data.favorite_shot || null,
        favorite_surface: form.favorite_surface as "arcilla" | "cesped" | "dura" | "sintetico",
        playing_style: parsed.data.playing_style || null,
        availability: parsed.data.availability || null,
        years_playing: parsed.data.years_playing ?? null,
        show_phone: form.show_phone,
        show_email: form.show_email,
        avatar_url: avatarUrl,
        padel_position: form.padel_position || null,
        padel_dominant_side: form.padel_dominant_side || null,
      })
      .eq("user_id", user.id);
    setSaving(false);
    if (error) {
      toast({ title: "No se pudo guardar", description: error.message, variant: "destructive" });
      return;
    }
    await refreshProfile();
    onSaved();
    onOpenChange(false);
    toast({ title: "Perfil actualizado" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar perfil</DialogTitle>
          <DialogDescription>
            Tus datos deportivos siempre se comparten con el club. Tu teléfono y email solo si activas los switches.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* === DATOS PERSONALES === */}
          <div className="space-y-3">
            <SectionTitle>Datos personales</SectionTitle>

            <div className="flex items-center gap-3">
              <Avatar className="h-16 w-16">
                <AvatarImage src={avatarUrl ?? undefined} />
                <AvatarFallback>
                  {form.first_name[0]}
                  {form.last_name[0]}
                </AvatarFallback>
              </Avatar>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                ) : (
                  <Upload className="mr-1 h-3 w-3" />
                )}
                Cambiar foto
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatar}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="first_name">Nombre</Label>
                <Input
                  id="first_name"
                  value={form.first_name}
                  onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                  maxLength={60}
                />
              </div>
              <div>
                <Label htmlFor="last_name">Apellido</Label>
                <Input
                  id="last_name"
                  value={form.last_name}
                  onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                  maxLength={60}
                />
              </div>
            </div>

            {/* Email (read-only) + toggle */}
            <div className="rounded-2xl border border-border p-3">
              <div className="flex items-center gap-2">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                <Label className="text-xs font-medium">Email</Label>
              </div>
              <p className="mt-1 truncate text-sm text-foreground">{profile.email}</p>
              <div className="mt-2 flex items-center justify-between gap-2 border-t border-border pt-2">
                <p className="text-[11px] text-muted-foreground">
                  Mostrar mi email a otros socios
                </p>
                <Switch
                  checked={form.show_email}
                  onCheckedChange={(c) => setForm({ ...form, show_email: c })}
                />
              </div>
            </div>

            {/* Teléfono editable + toggle */}
            <div className="rounded-2xl border border-border p-3">
              <div className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                <Label htmlFor="phone" className="text-xs font-medium">Teléfono</Label>
              </div>
              <Input
                id="phone"
                type="tel"
                inputMode="tel"
                className="mt-1"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+56 9 1234 5678"
                maxLength={30}
              />
              <div className="mt-2 flex items-center justify-between gap-2 border-t border-border pt-2">
                <p className="text-[11px] text-muted-foreground">
                  Mostrar mi teléfono a otros socios
                </p>
                <Switch
                  checked={form.show_phone}
                  onCheckedChange={(c) => setForm({ ...form, show_phone: c })}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* === DATOS DEPORTIVOS === */}
          <div className="space-y-3">
            <SectionTitle>Datos de juego (visibles al club)</SectionTitle>

            <div>
              <Label htmlFor="bio">Bio (máx. 280)</Label>
              <Textarea
                id="bio"
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
                maxLength={280}
                rows={3}
                placeholder="Cuéntanos algo de tu juego..."
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Mano dominante</Label>
                <Select
                  value={form.dominant_hand}
                  onValueChange={(v) => setForm({ ...form, dominant_hand: v as typeof form.dominant_hand })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="right">Diestro</SelectItem>
                    <SelectItem value="left">Zurdo</SelectItem>
                    <SelectItem value="ambi">Ambidiestro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Revés</Label>
                <Select
                  value={form.backhand}
                  onValueChange={(v) => setForm({ ...form, backhand: v as typeof form.backhand })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="one_handed">Una mano</SelectItem>
                    <SelectItem value="two_handed">Dos manos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="favorite_shot">Golpe favorito</Label>
                <Input
                  id="favorite_shot"
                  value={form.favorite_shot}
                  onChange={(e) => setForm({ ...form, favorite_shot: e.target.value })}
                  maxLength={60}
                  placeholder="Drive, saque, volea..."
                />
              </div>
              <div>
                <Label>Superficie favorita</Label>
                <Select
                  value={form.favorite_surface}
                  onValueChange={(v) => setForm({ ...form, favorite_surface: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="arcilla">Arcilla</SelectItem>
                    <SelectItem value="dura">Dura</SelectItem>
                    <SelectItem value="cesped">Césped</SelectItem>
                    <SelectItem value="sintetico">Sintético</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="playing_style">Estilo</Label>
                <Input
                  id="playing_style"
                  value={form.playing_style}
                  onChange={(e) => setForm({ ...form, playing_style: e.target.value })}
                  maxLength={60}
                  placeholder="Defensivo, agresivo..."
                />
              </div>
              <div>
                <Label htmlFor="years_playing">Años jugando</Label>
                <Input
                  id="years_playing"
                  type="number"
                  min={0}
                  max={80}
                  value={form.years_playing}
                  onChange={(e) => setForm({ ...form, years_playing: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="availability">Disponibilidad</Label>
              <Input
                id="availability"
                value={form.availability}
                onChange={(e) => setForm({ ...form, availability: e.target.value })}
                maxLength={120}
                placeholder="Lun-Mié 19:00, sábados AM..."
              />
            </div>
          </div>

          <Separator />

          {/* === PÁDEL === */}
          <div className="space-y-3">
            <SectionTitle>Pádel (opcional)</SectionTitle>
            <p className="text-[11px] text-muted-foreground">
              Si juegas pádel, completa estos datos para que sugiramos compañeros compatibles.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Posición</Label>
                <Select
                  value={form.padel_position || "none"}
                  onValueChange={(v) =>
                    setForm({ ...form, padel_position: v === "none" ? "" : v })
                  }
                >
                  <SelectTrigger><SelectValue placeholder="Sin definir" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin definir</SelectItem>
                    <SelectItem value="drive">Drive (derecha)</SelectItem>
                    <SelectItem value="reves">Revés (izquierda)</SelectItem>
                    <SelectItem value="ambos">Indistinto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Lado dominante</Label>
                <Select
                  value={form.padel_dominant_side || "none"}
                  onValueChange={(v) =>
                    setForm({ ...form, padel_dominant_side: v === "none" ? "" : v })
                  }
                >
                  <SelectTrigger><SelectValue placeholder="Sin definir" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin definir</SelectItem>
                    <SelectItem value="right">Diestro</SelectItem>
                    <SelectItem value="left">Zurdo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
