import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

// FASE A · alta manual del organizador (FUNCIONAL, sin pulir — el reskin Arena es Fase B).
// Form para agregar jugadores uno por uno (organizer_add_player) + lista de
// participantes con su vía de inscripción. Protegido: solo organizador/admin.
interface Participant {
  roster_player_id: string;
  display_name: string;
  email: string | null;
  phone: string | null;
  source: "self" | "manual" | "import";
  claimed: boolean;
}

const SOURCE_LABEL: Record<string, string> = { self: "auto-inscrito", manual: "alta manual", import: "planilla" };

const RosterManager = () => {
  const { catId } = useParams<{ catId: string }>();
  const [canManage, setCanManage] = useState<boolean | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!catId) return;
    const { data } = await supabase.rpc("round_robin_participants", { _category_id: catId });
    setParticipants((data as Participant[] | null) ?? []);
    setLoading(false);
  }, [catId]);

  useEffect(() => {
    if (!catId) return;
    void (async () => {
      const { data } = await supabase.rpc("rr_can_manage", { _category_id: catId });
      setCanManage(Boolean(data));
      await load();
    })();
  }, [catId, load]);

  const addPlayer = async () => {
    if (!catId || !name.trim()) { toast.error("El nombre es obligatorio"); return; }
    setSaving(true);
    const { error } = await supabase.rpc("organizer_add_player", {
      _category_id: catId,
      _display_name: name.trim(),
      _email: email.trim() || null,
      _phone: phone.trim() || null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${name.trim()} agregado`);
    setName(""); setEmail(""); setPhone("");
    await load();
  };

  return (
    <AppShell>
      <div className="min-h-screen bg-gradient-warm pb-20">
        <header className="border-b border-border bg-background/85 px-5 py-4">
          <div className="mx-auto flex max-w-md items-center gap-3">
            <Link to="/torneos" className="flex h-9 w-9 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground hover:text-foreground" aria-label="Volver">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="font-display text-lg font-semibold">Inscritos</h1>
              <p className="text-xs text-muted-foreground">Alta manual del organizador</p>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-md space-y-5 px-5 pt-4">
          {canManage === false && (
            <p className="rounded-2xl border border-dashed border-border bg-card/50 p-6 text-center text-sm text-muted-foreground">
              Solo el organizador o admin del torneo puede gestionar inscritos.
            </p>
          )}

          {canManage && (
            <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
              <p className="text-sm font-semibold">Agregar jugador</p>
              <div className="space-y-1.5">
                <Label htmlFor="rp-name">Nombre *</Label>
                <Input id="rp-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre y apellido" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="rp-email">Email (opcional)</Label>
                  <Input id="rp-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="correo@…" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rp-phone">Teléfono (opcional)</Label>
                  <Input id="rp-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+56…" />
                </div>
              </div>
              <Button onClick={addPlayer} disabled={saving} className="w-full">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><UserPlus className="mr-1 h-4 w-4" /> Agregar</>}
              </Button>
            </section>
          )}

          <section className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Participantes ({participants.length})
            </p>
            {loading ? (
              <p className="text-sm text-muted-foreground">Cargando…</p>
            ) : participants.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border bg-card/50 p-6 text-center text-sm text-muted-foreground">
                Aún no hay inscritos.
              </p>
            ) : (
              <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
                {participants.map((p) => (
                  <li key={p.roster_player_id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{p.display_name}</p>
                      {(p.email || p.phone) && (
                        <p className="truncate text-[11px] text-muted-foreground">{p.email ?? p.phone}</p>
                      )}
                    </div>
                    <span className="shrink-0 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                      {SOURCE_LABEL[p.source] ?? p.source}
                      {p.claimed && " · vinculado"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </main>
      </div>
    </AppShell>
  );
};

export default RosterManager;
