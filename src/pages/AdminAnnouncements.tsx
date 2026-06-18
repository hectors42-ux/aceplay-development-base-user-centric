import { useEffect, useState } from "react";
import { ArrowLeft, Plus, Loader2, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

type Announcement = Database["public"]["Tables"]["club_announcements"]["Row"];

const schema = z.object({
  title: z.string().trim().min(2, "Título requerido").max(120),
  body: z.string().trim().max(500).optional().or(z.literal("")),
  cta_label: z.string().trim().max(40).optional().or(z.literal("")),
  cta_url: z.string().trim().url("URL inválida").max(500).optional().or(z.literal("")),
});

const AdminAnnouncements = () => {
  const { profile } = useAuth();
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    body: "",
    cta_label: "",
    cta_url: "",
    priority: "info" as "info" | "highlight" | "urgent",
    ends_at: "",
  });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("club_announcements")
      .select("*")
      .order("starts_at", { ascending: false });
    setItems((data ?? []) as Announcement[]);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const handleCreate = async () => {
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast({
        title: "Datos inválidos",
        description: parsed.error.errors[0]?.message,
        variant: "destructive",
      });
      return;
    }
    if (!profile) return;
    setSaving(true);
    const { error } = await supabase.from("club_announcements").insert({
      tenant_id: profile.tenant_id,
      title: parsed.data.title,
      body: parsed.data.body || null,
      cta_label: parsed.data.cta_label || null,
      cta_url: parsed.data.cta_url || null,
      priority: form.priority,
      ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    setOpen(false);
    setForm({ title: "", body: "", cta_label: "", cta_url: "", priority: "info", ends_at: "" });
    toast({ title: "Anuncio publicado" });
    void load();
  };

  const handleToggle = async (a: Announcement) => {
    await supabase
      .from("club_announcements")
      .update({ is_published: !a.is_published })
      .eq("id", a.id);
    void load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este anuncio?")) return;
    await supabase.from("club_announcements").delete().eq("id", id);
    void load();
  };

  return (
    <div className="min-h-screen bg-gradient-warm pb-12">
      <header className="sticky top-0 z-10 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-md items-center gap-3 px-5 py-4">
          <Link
            to="/"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-muted hover:bg-muted/70"
            aria-label="Volver"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1">
            <h1 className="font-display text-lg font-semibold">Anuncios del club</h1>
            <p className="text-[11px] text-muted-foreground">Banners visibles en el home</p>
          </div>
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="mr-1 h-4 w-4" /> Nuevo
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-md space-y-3 px-5 pt-4">
        {loading ? (
          <p className="text-center text-sm text-muted-foreground">Cargando…</p>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center text-sm text-muted-foreground">
            Sin anuncios. Crea el primero.
          </div>
        ) : (
          items.map((a) => (
            <div key={a.id} className="rounded-2xl border border-border bg-card p-4 shadow-card">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <span className="inline-block rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase">
                    {a.priority}
                  </span>
                  <h3 className="mt-1 font-display text-base font-semibold">{a.title}</h3>
                  {a.body && <p className="mt-1 text-xs text-muted-foreground">{a.body}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(a.id)}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                <span className="text-[11px] text-muted-foreground">
                  {a.is_published ? "Publicado" : "Oculto"}
                </span>
                <Button size="sm" variant="outline" onClick={() => handleToggle(a)}>
                  {a.is_published ? "Ocultar" : "Publicar"}
                </Button>
              </div>
            </div>
          ))
        )}
      </main>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo anuncio</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="t">Título</Label>
              <Input id="t" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={120} />
            </div>
            <div>
              <Label htmlFor="b">Mensaje</Label>
              <Textarea id="b" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} maxLength={500} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="cl">Botón (texto)</Label>
                <Input id="cl" value={form.cta_label} onChange={(e) => setForm({ ...form, cta_label: e.target.value })} maxLength={40} />
              </div>
              <div>
                <Label htmlFor="cu">Botón (URL)</Label>
                <Input id="cu" value={form.cta_url} onChange={(e) => setForm({ ...form, cta_url: e.target.value })} placeholder="https://..." />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Prioridad</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as typeof form.priority })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">Info</SelectItem>
                    <SelectItem value="highlight">Destacado</SelectItem>
                    <SelectItem value="urgent">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="ea">Vence (opcional)</Label>
                <Input id="ea" type="date" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
              Publicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminAnnouncements;
