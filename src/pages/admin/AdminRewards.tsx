import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Plus, Pencil, Trash2, Loader2, Gift, Coins } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

interface Brand { id: string; name: string }
interface Reward { id: string; brand_id: string; title: string; benefit_label: string; cost_fichas: number; stock: number | null; terms: string | null; sport_scope: string | null; active: boolean }
const empty: Partial<Reward> = { title: "", benefit_label: "", cost_fichas: 50, stock: null, terms: "", active: true };

const AdminRewards = () => {
  const [rows, setRows] = useState<(Reward & { brand_name?: string })[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<Partial<Reward> | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [r, b] = await Promise.all([
      supabase.from("reward_items").select("*, brands(name)").order("created_at", { ascending: false }),
      supabase.from("brands").select("id, name").order("name"),
    ]);
    setRows(((r.data as (Reward & { brands: { name: string } })[] | null) ?? []).map((x) => ({ ...x, brand_name: x.brands?.name })));
    setBrands((b.data as Brand[] | null) ?? []);
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    if (!edit?.brand_id || !edit?.benefit_label?.trim() || !edit?.cost_fichas) { toast.error("Marca, beneficio y costo en Fichas obligatorios"); return; }
    setBusy(true);
    const payload = {
      brand_id: edit.brand_id, title: edit.title ?? edit.benefit_label, benefit_label: edit.benefit_label,
      cost_fichas: Number(edit.cost_fichas), stock: edit.stock === null || edit.stock === undefined ? null : Number(edit.stock),
      terms: edit.terms || null, sport_scope: edit.sport_scope || null, active: edit.active ?? true,
    };
    const { error } = edit.id ? await supabase.from("reward_items").update(payload).eq("id", edit.id) : await supabase.from("reward_items").insert(payload);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(edit.id ? "Premio actualizado" : "Premio creado"); setEdit(null); void load();
  };
  const del = async (id: string) => {
    const { error } = await supabase.from("reward_items").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Premio eliminado"); void load();
  };

  return (
    <div className="mx-auto max-w-md px-5 py-6">
      <div className="mb-5 flex items-center gap-3">
        <Link to="/perfil" className="flex h-9 w-9 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground"><ArrowLeft className="h-4 w-4" /></Link>
        <div className="flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Admin</p>
          <h1 className="flex items-center gap-2 font-display text-xl font-semibold"><Gift className="h-5 w-5 text-primary" /> Catálogo de Fichas</h1>
        </div>
        <Button size="sm" variant="clay" onClick={() => setEdit({ ...empty })}><Plus className="h-4 w-4" /> Nuevo</Button>
      </div>
      <p className="mb-3 text-[11px] text-muted-foreground">El costo se expresa en Fichas. Nunca precios en pesos.</p>

      {loading ? <p className="text-sm text-muted-foreground">Cargando…</p> : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-card">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{r.benefit_label}</p>
                <p className="flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                  {r.brand_name} · <Coins className="h-3 w-3" /> {r.cost_fichas} Fichas {r.stock != null ? `· stock ${r.stock}` : ""} {r.active ? "" : "· inactivo"}
                </p>
              </div>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEdit(r)}><Pencil className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => del(r.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!edit} onOpenChange={(o) => { if (!o) setEdit(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit?.id ? "Editar premio" : "Nuevo premio"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Marca</Label>
              <Select value={edit?.brand_id ?? ""} onValueChange={(v) => setEdit({ ...edit, brand_id: v })}>
                <SelectTrigger><SelectValue placeholder="Elige una marca" /></SelectTrigger>
                <SelectContent>{brands.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Beneficio (texto, sin precios)</Label><Input value={edit?.benefit_label ?? ""} placeholder="20% en Wilson" onChange={(e) => setEdit({ ...edit, benefit_label: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Título interno</Label><Input value={edit?.title ?? ""} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></div>
            <div className="flex gap-3">
              <div className="flex-1 space-y-1.5"><Label>Costo (Fichas)</Label><Input type="number" min={1} value={edit?.cost_fichas ?? 50} onChange={(e) => setEdit({ ...edit, cost_fichas: Number(e.target.value) })} /></div>
              <div className="flex-1 space-y-1.5"><Label>Stock (vacío = ∞)</Label><Input type="number" value={edit?.stock ?? ""} onChange={(e) => setEdit({ ...edit, stock: e.target.value === "" ? null : Number(e.target.value) })} /></div>
            </div>
            <div className="space-y-1.5"><Label>Términos</Label><Input value={edit?.terms ?? ""} onChange={(e) => setEdit({ ...edit, terms: e.target.value })} /></div>
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

export default AdminRewards;
