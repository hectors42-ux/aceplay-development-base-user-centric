import { useRef, useState } from "react";
import { Loader2, ImagePlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/image-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// Toggle de visibilidad con texto claro por opción (Part A).
const VISIBILITY = [
  { value: "members", label: "Solo socios", desc: "Cerrado: solo socios de tu club con acceso directo." },
  { value: "hierarchy", label: "Mi club", desc: "Los socios de tu club lo descubren dentro del club." },
  { value: "public", label: "Abierto · red AcePlay", desc: "Cualquier jugador de cualquier club lo encuentra en Descubrir." },
];

const MOTORES = [
  { value: "single_elimination", label: "Eliminación simple" },
  { value: "round_robin", label: "Round robin" },
  { value: "consolation", label: "Consolación" },
  { value: "groups_playoff", label: "Grupos → playoff" },
  { value: "double_elimination", label: "Doble eliminación" },
  { value: "americano", label: "Americano de rotación" },
];

interface Props {
  kind: "escalerilla" | "tournament";
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: (id: string) => void;
}

export const CreateSpaceDialog = ({ kind, open, onOpenChange, onCreated }: Props) => {
  const [name, setName] = useState("");
  const [sport, setSport] = useState<"tennis" | "padel">("padel");
  const [visibility, setVisibility] = useState("public");
  const [motor, setMotor] = useState("round_robin");
  const [categoryLabel, setCategoryLabel] = useState("Categoría OPEN");
  const [logoUrl, setLogoUrl] = useState("");
  const [brandColor, setBrandColor] = useState("#EC6E2E");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Subir el logo del club al bucket (carpeta {club_id}); el organizador gestiona su marca.
  const handleLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Sube una imagen."); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error("Máx. 10MB."); return; }
    setUploading(true);
    try {
      const { data: clubId } = await supabase.rpc("my_organizer_club");
      if (!clubId) { toast.error("Necesitas ser organizador/admin de un club."); return; }
      const compressed = await compressImage(file, { maxSize: 512, quality: 0.9 });
      const path = `${clubId}/logo-${Date.now()}.jpg`;
      const { error } = await supabase.storage.from("club-logos").upload(path, compressed, {
        cacheControl: "31536000", upsert: false, contentType: "image/jpeg",
      });
      if (error) throw error;
      const { data: pub } = supabase.storage.from("club-logos").getPublicUrl(path);
      setLogoUrl(pub.publicUrl);
      toast.success("Logo subido.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo subir el logo.");
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    if (!name.trim()) { toast.error("Ponle un nombre"); return; }
    setBusy(true);
    const { data, error } = kind === "escalerilla"
      ? await supabase.rpc("create_escalerilla", { _name: name.trim(), _sport: sport, _visibility: visibility })
      : await supabase.rpc("create_tournament", {
          _name: name.trim(), _sport: sport, _visibility: visibility, _motor: motor, _category_label: categoryLabel.trim(),
        });
    // Marca del club (opcional): la expone en Espacios/Descubrir. Solo si se indicó.
    if (!error && (logoUrl.trim() || brandColor)) {
      await supabase.rpc("set_club_branding", { _logo_url: logoUrl.trim() || null, _primary: brandColor || null });
    }
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(kind === "escalerilla" ? "Escalerilla creada." : "Torneo creado.");
    onOpenChange(false);
    setName("");
    onCreated(data as string);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{kind === "escalerilla" ? "Nueva escalerilla" : "Nuevo torneo"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nombre</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)}
              placeholder={kind === "escalerilla" ? "Escalerilla de verano" : "Abierto de primavera"} />
          </div>
          <div className="space-y-1.5">
            <Label>Deporte</Label>
            <Select value={sport} onValueChange={(v) => setSport(v as "tennis" | "padel")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="tennis">Tenis</SelectItem>
                <SelectItem value="padel">Pádel</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {kind === "tournament" && (
            <>
              <div className="space-y-1.5">
                <Label>Formato</Label>
                <Select value={motor} onValueChange={setMotor}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MOTORES.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Categoría</Label>
                <Input value={categoryLabel} onChange={(e) => setCategoryLabel(e.target.value)} />
              </div>
            </>
          )}
          {/* Marca del club (opcional): logo + color con que el club se expone en Espacios. */}
          <div className="space-y-2 rounded-2xl border border-border bg-muted/30 p-3">
            <Label className="text-xs text-muted-foreground">Marca de tu club (opcional)</Label>
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl border border-border bg-white"
                style={!logoUrl ? { background: brandColor } : undefined}>
                {logoUrl
                  ? <img src={logoUrl} alt="" className="h-full w-full object-contain" />
                  : <ImagePlus className="h-5 w-5 text-white/80" />}
              </span>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogo} />
              <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : logoUrl ? "Cambiar logo" : "Subir logo"}
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <input type="color" value={brandColor} onChange={(e) => setBrandColor(e.target.value)} aria-label="Color del club" className="h-9 w-12 cursor-pointer rounded-lg border border-border bg-transparent" />
              <span className="text-[11px] text-muted-foreground">Color del club · se ve en su tarjeta de Espacios.</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Visibilidad</Label>
            <div className="space-y-2">
              {VISIBILITY.map((v) => (
                <button key={v.value} type="button" onClick={() => setVisibility(v.value)}
                  className={cn("w-full rounded-2xl border p-3 text-left transition-smooth",
                    visibility === v.value ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border hover:bg-muted")}>
                  <p className="text-sm font-semibold text-foreground">{v.label}</p>
                  <p className="text-[11px] text-muted-foreground">{v.desc}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="clay" disabled={busy} onClick={submit}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crear"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateSpaceDialog;
