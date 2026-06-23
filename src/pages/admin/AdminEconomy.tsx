import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Loader2, SlidersHorizontal, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ConfigRow { key: string; value: unknown }

/**
 * Editor de economy_config. Cambia PARÁMETROS de cálculo (tasas XP, costos de
 * Fichas, ventanas, expiración). NO inyecta saldos retroactivos: solo escribe la
 * fila de config; los ledgers de usuarios no se tocan desde aquí.
 */
const AdminEconomy = () => {
  const [rows, setRows] = useState<ConfigRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("economy_config").select("key, value").order("key");
    const list = (data as ConfigRow[] | null) ?? [];
    setRows(list);
    setDrafts(Object.fromEntries(list.map((r) => [r.key, JSON.stringify(r.value, null, 2)])));
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const save = async (key: string) => {
    let parsed: unknown;
    try { parsed = JSON.parse(drafts[key]); } catch { toast.error("JSON inválido"); return; }
    setBusy(key);
    const { error } = await supabase.from("economy_config").update({ value: parsed, updated_at: new Date().toISOString() }).eq("key", key);
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success(`"${key}" actualizado`);
  };

  return (
    <div className="mx-auto max-w-md px-5 py-6">
      <div className="mb-5 flex items-center gap-3">
        <Link to="/perfil" className="flex h-9 w-9 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground"><ArrowLeft className="h-4 w-4" /></Link>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Admin</p>
          <h1 className="flex items-center gap-2 font-display text-xl font-semibold"><SlidersHorizontal className="h-5 w-5 text-primary" /> Economía</h1>
        </div>
      </div>
      <p className="mb-4 text-[11px] text-muted-foreground">Edita parámetros (XP, Fichas, ligas, ventanas). Cambia el cálculo a futuro; no inyecta saldos.</p>

      {loading ? <p className="text-sm text-muted-foreground">Cargando…</p> : (
        <div className="space-y-4">
          {rows.map((r) => (
            <div key={r.key} className="rounded-2xl border border-border bg-card p-3 shadow-card">
              <div className="mb-2 flex items-center justify-between">
                <p className="font-display text-sm font-semibold">{r.key}</p>
                <Button size="sm" variant="clay" className="h-7" disabled={busy === r.key} onClick={() => save(r.key)}>
                  {busy === r.key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Save className="h-3.5 w-3.5" /> Guardar</>}
                </Button>
              </div>
              <textarea
                value={drafts[r.key] ?? ""}
                onChange={(e) => setDrafts({ ...drafts, [r.key]: e.target.value })}
                rows={Math.min(12, (drafts[r.key]?.split("\n").length ?? 3))}
                spellCheck={false}
                className="w-full rounded-xl border border-border bg-background p-2 font-mono text-[11px] leading-snug"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminEconomy;
