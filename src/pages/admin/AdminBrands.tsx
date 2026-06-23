import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Plus, Pencil, Trash2, Loader2, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

interface Brand { id: string; name: string; slug: string; status: string; logo_url: string | null; hero_url: string | null; contact: Record<string, unknown> }
const empty: Partial<Brand> = { name: "", slug: "", status: "active", logo_url: "", hero_url: "" };

const AdminBrands = () => {
  const [rows, setRows] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<Partial<Brand> | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("brands").select("*").order("name");
    setRows((data as Brand[] | null) ?? []);
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    if (!edit?.name?.trim() || !edit?.slug?.trim()) { toast.error("Nombre y slug obligatorios"); return; }
    setBusy(true);
    const payload = { name: edit.name, slug: edit.slug, status: edit.status ?? "active", logo_url: edit.logo_url || null, hero_url: edit.hero_url || null };
    const { error } = edit.id
      ? await supabase.from("brands").update(payload).eq("id", edit.id)
      : await supabase.from("brands").insert(payload);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(edit.id ? "Marca actualizada" : "Marca creada");
    setEdit(null); void load();
  };

  const del = async (id: string) => {
    const { error } = await supabase.from("brands").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Marca eliminada"); void load();
  };

  return (
    <div className="mx-auto max-w-md px-5 py-6">
      <div className="mb-5 flex items-center gap-3">
        <Link to="/perfil" className="flex h-9 w-9 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground"><ArrowLeft className="h-4 w-4" /></Link>
        <div className="flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Admin</p>
          <h1 className="flex items-center gap-2 font-display text-xl font-semibold"><Building2 className="h-5 w-5 text-primary" /> Marcas</h1>
        </div>
        <Button size="sm" variant="clay" onClick={() => setEdit({ ...empty })}><Plus className="h-4 w-4" /> Nueva</Button>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Cargando…</p> : (
        <div className="space-y-2">
          {rows.map((b) => (
            <div key={b.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-card">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{b.name}</p>
                <p className="truncate text-[11px] text-muted-foreground">{b.slug} · {b.status}</p>
              </div>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEdit(b)}><Pencil className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => del(b.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!edit} onOpenChange={(o) => { if (!o) setEdit(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit?.id ? "Editar marca" : "Nueva marca"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Nombre</Label><Input value={edit?.name ?? ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Slug</Label><Input value={edit?.slug ?? ""} onChange={(e) => setEdit({ ...edit, slug: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Estado</Label><Input value={edit?.status ?? "active"} onChange={(e) => setEdit({ ...edit, status: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Logo URL</Label><Input value={edit?.logo_url ?? ""} onChange={(e) => setEdit({ ...edit, logo_url: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Hero URL</Label><Input value={edit?.hero_url ?? ""} onChange={(e) => setEdit({ ...edit, hero_url: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)}>Cancelar</Button>
            <Button variant="clay" disabled={busy} onClick={save}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminBrands;
