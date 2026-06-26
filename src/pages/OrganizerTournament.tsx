import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Trophy, Users, Wand2, Settings2, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTournamentDetailEnriched } from "@/hooks/useTournamentDetailEnriched";
import { useCanManageSpace } from "@/hooks/useCanManageSpace";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ── CASA DEL ORGANIZADOR (motor VIVO). Por categoría: inscritos + generar llave +
// cargar resultados con el RPC correcto por formato. NO usa la capa legacy muerta
// (tournament_categories/submit_match_result/is_tournament_manager). Solo el
// organizador/admin (gate space_can_manage) ve y entra. ─────────────────────────

interface Slot {
  slot_id: string; bracket: string; round: number; slot: number;
  player_a: string | null; name_a: string | null;
  player_b: string | null; name_b: string | null;
  winner: string | null; status: string; match_id: string | null;
}
interface RosterP { roster_player_id: string; display_name: string; source: string; claimed: boolean }
interface Standing { display_name: string; partidos_ganados: number; sets_ganados: number; juegos_ganados: number; puntos_st: number; puntaje: number }

const STATUS_LABEL: Record<string, string> = {
  played: "Jugado", played_pending: "Esperando confirmación", bye: "Bye", playable: "Por jugar", pending: "Pendiente",
};

// Editor de sets minimalista (3 sets; el 3º puede ser super tie-break).
type SetRow = { a: string; b: string; tb: boolean };
const emptySets = (): SetRow[] => [{ a: "", b: "", tb: false }, { a: "", b: "", tb: false }, { a: "", b: "", tb: false }];
const buildSets = (rows: SetRow[]) =>
  rows.filter((r) => r.a !== "" && r.b !== "")
    .map((r) => ({ games_a: Number(r.a), games_b: Number(r.b), is_tiebreak: r.tb }));

function SetsEditor({ rows, onChange }: { rows: SetRow[]; onChange: (r: SetRow[]) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">Sets (deja vacío lo que no aplique)</Label>
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-12 text-[11px] text-muted-foreground">Set {i + 1}</span>
          <Input type="number" min={0} max={20} value={r.a} className="w-14" placeholder="A"
            onChange={(e) => onChange(rows.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)))} />
          <span className="text-muted-foreground">-</span>
          <Input type="number" min={0} max={20} value={r.b} className="w-14" placeholder="B"
            onChange={(e) => onChange(rows.map((x, j) => (j === i ? { ...x, b: e.target.value } : x)))} />
          {i === 2 && (
            <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <input type="checkbox" checked={r.tb}
                onChange={(e) => onChange(rows.map((x, j) => (j === i ? { ...x, tb: e.target.checked } : x)))} />
              super&nbsp;TB
            </label>
          )}
        </div>
      ))}
    </div>
  );
}

function CategoryAdmin({ catId, name }: { catId: string; name: string }) {
  const [loading, setLoading] = useState(true);
  const [roster, setRoster] = useState<RosterP[]>([]);
  const [isRoster, setIsRoster] = useState(false);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [busy, setBusy] = useState(false);
  // diálogo de resultado (motor)
  const [slotResult, setSlotResult] = useState<Slot | null>(null);
  const [winnerSide, setWinnerSide] = useState<"a" | "b">("a");
  const [setRows, setSetRows] = useState<SetRow[]>(emptySets());
  // form de resultado (roster)
  const [pa, setPa] = useState(""); const [pb, setPb] = useState(""); const [pwin, setPwin] = useState<"a" | "b">("a");
  const [rosterSets, setRosterSets] = useState<SetRow[]>(emptySets());

  const load = useCallback(async () => {
    setLoading(true);
    const { data: parts } = await supabase.rpc("round_robin_participants", { _category_id: catId });
    const rosterRows = (parts as RosterP[] | null) ?? [];
    const roster = rosterRows.length > 0;
    setRoster(rosterRows);
    setIsRoster(roster);
    if (roster) {
      const { data: st } = await supabase.rpc("round_robin_standings", { _category_id: catId });
      setStandings((st as Standing[] | null) ?? []);
    } else {
      const { data: bk } = await supabase.rpc("bracket_view", { _category_id: catId });
      setSlots((bk as Slot[] | null) ?? []);
    }
    setLoading(false);
  }, [catId]);

  useEffect(() => { void load(); }, [load]);

  const generated = isRoster ? false : slots.length > 0;

  const generar = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("org_generate_bracket", { _category_id: catId });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Llave generada."); await load();
  };

  const submitMotor = async () => {
    if (!slotResult) return;
    setBusy(true);
    const { error } = await supabase.rpc("org_record_bracket_result", {
      _slot_id: slotResult.slot_id, _winner_side: winnerSide, _sets: buildSets(setRows),
    });
    setBusy(false);
    setSlotResult(null); setSetRows(emptySets()); setWinnerSide("a");
    if (error) { toast.error(error.message); return; }
    toast.success("Resultado cargado. Se confirma y mueve el rating por el motor."); await load();
  };

  const submitRoster = async () => {
    if (!pa || !pb || pa === pb) { toast.error("Elige dos jugadores distintos"); return; }
    setBusy(true);
    const winner = pwin === "a" ? pa : pb;
    const { error } = await supabase.rpc("rr_record_result", {
      _category_id: catId, _player_a: pa, _player_b: pb, _winner: winner, _sets: buildSets(rosterSets),
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Resultado cargado."); setPa(""); setPb(""); setRosterSets(emptySets()); await load();
  };

  if (loading) return <Skeleton className="h-32 w-full rounded-2xl" />;

  return (
    <div className="space-y-4">
      {/* Inscritos */}
      <section className="rounded-2xl border border-border bg-card p-3">
        <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Users className="h-3.5 w-3.5" /> Inscritos · {isRoster ? `${roster.length} (roster)` : `${new Set(slots.flatMap((s) => [s.player_a, s.player_b]).filter(Boolean)).size} (motor)`}
        </p>
        {isRoster ? (
          <div className="flex flex-wrap gap-1.5">
            {roster.map((p) => (
              <span key={p.roster_player_id} className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11px]">
                {p.display_name}{p.claimed ? " ·✓" : ""}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">{generated ? "Inscritos en la llave generada." : "Inscritos del motor."}</p>
        )}
      </section>

      {/* Generar llave (solo motor sin llave) */}
      {!isRoster && !generated && (
        <Button onClick={generar} disabled={busy} className="w-full bg-action text-action-foreground hover:bg-action/90">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Wand2 className="mr-1 h-4 w-4" /> Generar llave</>}
        </Button>
      )}

      {/* MOTOR: partidos con carga de resultado */}
      {!isRoster && generated && (
        <section className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Partidos</p>
          {slots.map((s) => {
            const canLoad = s.status === "playable" && !s.match_id && s.player_a && s.player_b;
            return (
              <div key={s.slot_id} className="rounded-xl border border-border bg-card p-2.5">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className={cn("truncate", s.winner === s.player_a && "font-semibold")}>{s.name_a ?? "—"}</span>
                  <span className="text-[10px] text-muted-foreground">vs</span>
                  <span className={cn("truncate", s.winner === s.player_b && "font-semibold")}>{s.name_b ?? "—"}</span>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{STATUS_LABEL[s.status] ?? s.status}</span>
                  {canLoad && (
                    <Button size="sm" variant="clay" className="h-7" onClick={() => { setSlotResult(s); setWinnerSide("a"); setSetRows(emptySets()); }}>
                      <Plus className="h-3.5 w-3.5" /> Cargar
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* ROSTER (Fase A): cargar resultado + tabla ponderada */}
      {isRoster && (
        <>
          <section className="space-y-2 rounded-2xl border border-border bg-card p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Cargar resultado</p>
            <div className="grid grid-cols-2 gap-2">
              <Select value={pa} onValueChange={setPa}>
                <SelectTrigger><SelectValue placeholder="Jugador A" /></SelectTrigger>
                <SelectContent>{roster.map((p) => <SelectItem key={p.roster_player_id} value={p.roster_player_id}>{p.display_name}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={pb} onValueChange={setPb}>
                <SelectTrigger><SelectValue placeholder="Jugador B" /></SelectTrigger>
                <SelectContent>{roster.map((p) => <SelectItem key={p.roster_player_id} value={p.roster_player_id}>{p.display_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Select value={pwin} onValueChange={(v) => setPwin(v as "a" | "b")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="a">Gana Jugador A</SelectItem><SelectItem value="b">Gana Jugador B</SelectItem></SelectContent>
            </Select>
            <SetsEditor rows={rosterSets} onChange={setRosterSets} />
            <Button onClick={submitRoster} disabled={busy} className="w-full bg-action text-action-foreground hover:bg-action/90">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cargar resultado"}
            </Button>
          </section>

          <section className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="grid grid-cols-[1fr_28px_28px_36px_44px] gap-1 border-b border-border px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <span>Jugador</span><span className="text-center">PG</span><span className="text-center">S</span><span className="text-center">J</span><span className="text-center">Pts</span>
            </div>
            {standings.map((r, i) => (
              <div key={i} className="grid grid-cols-[1fr_28px_28px_36px_44px] gap-1 px-3 py-1.5 text-sm">
                <span className="truncate">{r.display_name}</span>
                <span className="text-center tabular-nums">{r.partidos_ganados}</span>
                <span className="text-center tabular-nums text-muted-foreground">{r.sets_ganados}</span>
                <span className="text-center tabular-nums text-muted-foreground">{r.juegos_ganados}</span>
                <span className="text-center font-display font-bold tabular-nums">{r.puntaje}</span>
              </div>
            ))}
          </section>
        </>
      )}

      {/* Diálogo de resultado (motor) */}
      <Dialog open={!!slotResult} onOpenChange={(o) => { if (!o) setSlotResult(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Cargar resultado</DialogTitle></DialogHeader>
          {slotResult && (
            <div className="space-y-3">
              <Select value={winnerSide} onValueChange={(v) => setWinnerSide(v as "a" | "b")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="a">Gana {slotResult.name_a}</SelectItem>
                  <SelectItem value="b">Gana {slotResult.name_b}</SelectItem>
                </SelectContent>
              </Select>
              <SetsEditor rows={setRows} onChange={setSetRows} />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSlotResult(null)}>Cancelar</Button>
            <Button variant="clay" disabled={busy} onClick={submitMotor}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cargar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const OrganizerTournament = () => {
  const { slug } = useParams<{ slug: string }>();
  const { tournament, categories, loading } = useTournamentDetailEnriched(slug);
  const { canManage, loading: gateLoading } = useCanManageSpace(tournament?.id);
  const [catId, setCatId] = useState<string>("");

  const cats = useMemo(() => categories ?? [], [categories]);
  useEffect(() => { if (!catId && cats.length) setCatId(cats[0].id); }, [cats, catId]);

  return (
    <AppShell>
      <div className="min-h-screen bg-gradient-warm pb-20">
        <header className="border-b border-border bg-background/85 px-5 py-4">
          <div className="mx-auto flex max-w-md items-center gap-3">
            <Link to={tournament ? `/torneos/${tournament.slug}` : "/espacios"}
              className="flex h-9 w-9 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground hover:text-foreground" aria-label="Volver">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-info">
                <Settings2 className="h-3.5 w-3.5" /> Gestión del organizador
              </p>
              <h1 className="truncate font-display text-lg font-semibold">{tournament?.name ?? "Torneo"}</h1>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-md space-y-4 px-5 pt-4">
          {loading || gateLoading ? (
            <Skeleton className="h-40 w-full rounded-2xl" />
          ) : !canManage ? (
            <p className="rounded-2xl border border-dashed border-border bg-card/50 p-6 text-center text-sm text-muted-foreground">
              Solo el organizador o admin del torneo puede gestionarlo.
            </p>
          ) : cats.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border bg-card/50 p-6 text-center text-sm text-muted-foreground">
              Este torneo aún no tiene categorías.
            </p>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1 text-xs text-muted-foreground"><Trophy className="h-3.5 w-3.5" /> Categoría</Label>
                <Select value={catId} onValueChange={setCatId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {catId && <CategoryAdmin key={catId} catId={catId} name={cats.find((c) => c.id === catId)?.name ?? ""} />}
            </>
          )}
        </main>
      </div>
    </AppShell>
  );
};

export default OrganizerTournament;
