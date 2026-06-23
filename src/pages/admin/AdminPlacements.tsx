import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Plus, Pencil, Trash2, Loader2, Megaphone, Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const SCOPES = ["home", "discover", "tournament", "ladder", "club", "store"];
interface Brand { id: string; name: string }
interface Placement { id: string; brand_id: string; scope: string; ref_id: string | null; slot: string; priority: number; paid_priority: boolean; weight: number; starts_at: string | null; ends_at: string | null; active: boolean }
const empty: Partial<Placement> = { scope: "home", slot: "default", priority: 0, paid_priority: false, weight: 1, active: true };

const AdminPlacements = () => {
  const [rows, setRows] = useState<(Placement & { brand_name?: string })[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<Partial<Placement> | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [p, b] = await Promise.all([
      supabase.from("sponsor_placements").select("*, brands(name)").order("scope").order("paid_priority", { ascending: false }).order("weight", { ascending: false }),
      supabase.from("brands").select("id, name").order("name"),
    ]);
    setRows(((p.data as (Placement & { brands: { name: string } })[] | null) ?? []).map((x) => ({ ...x, brand_name: x.brands?.name })));
    setBrands((b.data as Brand[] | null) ?? []);
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    if (!edit?.brand_id || !edit?.scope) { toast.error("Marca y scope obligatorios"); return; }
    setBusy(true);
    const payload = {
      brand_id: edit.brand_id, scope: edit.scope, ref_id: edit.ref_id || null, slot: edit.slot || "default",
      priority: Number(edit.priority ?? 0), paid_priority: !!edit.paid_priority, weight: Number(edit.weight ?? 1),
      starts_at: edit.starts_at || null, ends_at: edit.ends_at || null, active: edit.active ?? true,
    };
    const { error } = edit.id ? await supabase.from("sponsor_placements").update(payload).eq("id", edit.id) : await supabase.from("sponsor_placements").insert(payload);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(edit.id ? "Placement actualizado" : "Placement creado"); setEdit(null); void load();
  };
  const del = async (id: string) => {
    const { error } = await supabase.from("sponsor_placements").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Placement eliminado"); void load();
  };

  return (
    <div className="mx-auto max-w-md px-5 py-6">
      <div className="mb-5 flex items-center gap-3">
        <Link to="/perfil" className="flex h-9 w-9 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground"><ArrowLeft className="h-4 w-4" /></Link>
        <div className="flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Admin</p>
          <h1 className="flex items-center gap-2 font-display text-xl font-semibold"><Megaphone className="h-5 w-5 text-primary" /> Placements</h1>
        </div>
        <Button size="sm" variant="clay" onClick={() => setEdit({ ...empty })}><Plus className="h-4 w-4" /> Nuevo</Button>
      </div>
      <p className="mb-3 text-[11px] text-muted-foreground">Ganador por: prioridad pagada → weight → rotación por ventana.</p>

      {loading ? <p className="text-sm text-muted-foreground">Cargando…</p> : (
        <div className="space-y-2">
          {rows.map((p) => (
            <div key={p.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-card">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1 truncate text-sm font-semibold">
                  {p.paid_priority && <Crown className="h-3.5 w-3.5 text-amber-500" />}{p.brand_name}
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">{p.scope}</span>
                </p>
                <p className="truncate text-[11px] text-muted-foreground">weight {p.weight} · prioridad {p.priority} {p.active ? "" : "· inactivo"}</p>
              </div>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEdit(p)}><Pencil className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => del(p.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!edit} onOpenChange={(o) => { if (!o) setEdit(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit?.id ? "Editar placement" : "Nuevo placement"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Marca</Label>
              <Select value={edit?.brand_id ?? ""} onValueChange={(v) => setEdit({ ...edit, brand_id: v })}>
                <SelectTrigger><SelectValue placeholder="Elige una marca" /></SelectTrigger>
                <SelectContent>{brands.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Superficie (scope)</Label>
              <Select value={edit?.scope ?? "home"} onValueChange={(v) => setEdit({ ...edit, scope: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SCOPES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex gap-3">
              <div className="flex-1 space-y-1.5"><Label>Weight</Label><Input type="number" min={0} value={edit?.weight ?? 1} onChange={(e) => setEdit({ ...edit, weight: Number(e.target.value) })} /></div>
              <div className="flex-1 space-y-1.5"><Label>Prioridad</Label><Input type="number" value={edit?.priority ?? 0} onChange={(e) => setEdit({ ...edit, priority: Number(e.target.value) })} /></div>
            </div>
            <div className="flex gap-3">
              <div className="flex-1 space-y-1.5"><Label>Desde</Label><Input type="date" value={edit?.starts_at?.slice(0, 10) ?? ""} onChange={(e) => setEdit({ ...edit, starts_at: e.target.value || null })} /></div>
              <div className="flex-1 space-y-1.5"><Label>Hasta</Label><Input type="date" value={edit?.ends_at?.slice(0, 10) ?? ""} onChange={(e) => setEdit({ ...edit, ends_at: e.target.value || null })} /></div>
            </div>
            <button type="button" onClick={() => setEdit({ ...edit, paid_priority: !edit?.paid_priority })}
              className={cn("flex w-full items-center justify-between rounded-2xl border p-3 text-left text-sm", edit?.paid_priority ? "border-amber-500 bg-amber-500/10" : "border-border")}>
              <span className="flex items-center gap-2"><Crown className="h-4 w-4 text-amber-500" /> Prioridad pagada</span>
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", edit?.paid_priority ? "bg-amber-500 text-white" : "bg-muted text-muted-foreground")}>{edit?.paid_priority ? "ON" : "OFF"}</span>
            </button>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={edit?.active ?? true} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} /> Activo</label>
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

export default AdminPlacements;
