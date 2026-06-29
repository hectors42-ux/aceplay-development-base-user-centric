import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Trophy, Users, Wand2, Settings2, Plus, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { WeightedStandings } from "@/components/tournaments/WeightedStandings";
import { H2HMatrix } from "@/components/tournaments/H2HMatrix";
import { RRProgressCard } from "@/components/tournaments/RRProgressCard";
import { useRRProgress } from "@/hooks/useRoundRobinExtras";
import { suggestDominantScore } from "@/lib/dominant-player";
import { FrozenTableAnimation } from "@/components/tournaments/admin/FrozenTableAnimation";
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
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0); // remonta tabla/H2H tras cargar un resultado
  // diálogo de resultado (motor)
  const [slotResult, setSlotResult] = useState<Slot | null>(null);
  const [winnerSide, setWinnerSide] = useState<"a" | "b">("a");
  const [setRows, setSetRows] = useState<SetRow[]>(emptySets());
  // form de resultado (roster)
  const [pa, setPa] = useState(""); const [pb, setPb] = useState(""); const [pwin, setPwin] = useState<"a" | "b">("a");
  const [rosterSets, setRosterSets] = useState<SetRow[]>(emptySets());
  const [dominante, setDominante] = useState(false); // #5 · partido interrumpido (regla del Jugador Dominante)
  const [resultType, setResultType] = useState<"normal" | "retiro" | "walkover">("normal");
  const { data: rrProgress } = useRRProgress(catId);

  // Asistente del anexo: A (jugador A) es el dominante; rellena el marcador final sugerido.
  const sugerirDominante = () => {
    const s = suggestDominantScore({
      set1A: Number(rosterSets[0]?.a || 0), set1B: Number(rosterSets[0]?.b || 0),
      set2A: Number(rosterSets[1]?.a || 0), set2B: Number(rosterSets[1]?.b || 0),
    });
    if (!s.ok) { toast.error(s.reason ?? "No se cumplen las condiciones del Jugador Dominante."); return; }
    setRosterSets([
      { a: String(s.set1A), b: String(s.set1B), tb: false },
      { a: String(s.set2A), b: String(s.set2B), tb: false },
      { a: "", b: "", tb: false },
    ]);
    setPwin("a");
    toast.success(`Sugerido: ${s.set1A}-${s.set1B}, ${s.set2A}-${s.set2B}. Revisa y carga.`);
  };
  // #6 · cierre
  const [closed, setClosed] = useState(false);
  const [closing, setClosing] = useState(false);
  const [podium, setPodium] = useState<{ gold?: string; silver?: string; bronze?: string }>({});
  const [showPodium, setShowPodium] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: parts }, { data: cat }] = await Promise.all([
      supabase.rpc("round_robin_participants", { _category_id: catId }),
      supabase.from("space").select("status").eq("id", catId).maybeSingle(),
    ]);
    const rosterRows = (parts as RosterP[] | null) ?? [];
    const roster = rosterRows.length > 0;
    setRoster(rosterRows);
    setIsRoster(roster);
    setClosed((cat as { status: string } | null)?.status === "finished");
    if (!roster) {
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
      _result_type: resultType,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(dominante ? "Marcador del Jugador Dominante cargado." : "Resultado cargado.");
    setPa(""); setPb(""); setRosterSets(emptySets()); setDominante(false); setResultType("normal");
    setRefresh((x) => x + 1); await load();
  };

  // #6 · cierre de la categoría (motor vivo). Congela el standings y arma el podio.
  const cerrar = async () => {
    if (!window.confirm("¿Cerrar la categoría? Se congela el standings final y no se podrán cargar más resultados.")) return;
    setClosing(true);
    const { error } = await supabase.rpc("close_category", { _category_id: catId });
    if (error) { setClosing(false); toast.error(error.message); return; }
    // podio = top 3 de la tabla ponderada (jerarquía de desempate del RPC).
    const { data: st } = await supabase.rpc("round_robin_standings", { _category_id: catId });
    const top = ((st as { display_name: string }[] | null) ?? []).slice(0, 3).map((r) => r.display_name);
    setPodium({ gold: top[0], silver: top[1], bronze: top[2] });
    setClosing(false);
    setClosed(true);
    setShowPodium(true);
    await load();
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
          {/* Avance del torneo + corte + zonas (igual que la vista jugador). */}
          <RRProgressCard categoryId={catId} />
          {closed ? (
            <section className="rounded-2xl border border-confirm/40 bg-confirm/5 p-3 text-center">
              <p className="text-sm font-semibold text-confirm">Categoría cerrada · standings congelado</p>
              {podium.gold && (
                <p className="mt-1 text-xs text-muted-foreground">
                  🥇 {podium.gold}{podium.silver ? ` · 🥈 ${podium.silver}` : ""}{podium.bronze ? ` · 🥉 ${podium.bronze}` : ""}
                </p>
              )}
            </section>
          ) : (
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
              {/* Tipo de resultado: normal / retiro / walkover (inconclusos del reglamento). */}
              <Select value={resultType} onValueChange={(v) => setResultType(v as "normal" | "retiro" | "walkover")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Resultado normal</SelectItem>
                  <SelectItem value="retiro">Retiro (se pondera lo jugado)</SelectItem>
                  <SelectItem value="walkover">Walkover (W.O.)</SelectItem>
                </SelectContent>
              </Select>
              {/* #5 · Regla del Jugador Dominante: marcador derivado + asistente del anexo. */}
              <label className="flex items-start gap-2 rounded-xl border border-border bg-muted/20 p-2 text-[11px] text-muted-foreground">
                <input type="checkbox" className="mt-0.5" checked={dominante} onChange={(e) => setDominante(e.target.checked)} />
                <span>
                  <span className="font-semibold text-foreground">Partido interrumpido · regla del Jugador Dominante.</span>{" "}
                  Ingresa el marcador al interrumpir (set 1 + set 2, con el <b>Jugador A</b> dominante) y usa el asistente del anexo.
                </span>
              </label>
              {dominante && (
                <Button type="button" variant="outline" size="sm" className="w-full" onClick={sugerirDominante}>
                  Sugerir marcador final (anexo)
                </Button>
              )}
              <Button onClick={submitRoster} disabled={busy} className="w-full bg-action text-action-foreground hover:bg-action/90">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : dominante ? "Cargar marcador derivado" : "Cargar resultado"}
              </Button>
            </section>
          )}

          {/* Tabla PONDERADA del reglamento (Fase A) + matriz H2H. */}
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Tabla ponderada</p>
            <WeightedStandings categoryId={catId} key={`st-${refresh}`} prizeTop={rrProgress?.prize_top ?? 0} asadoBottom={rrProgress?.asado_bottom ?? 0} />
          </div>
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Enfrentamientos (H2H)</p>
            <H2HMatrix categoryId={catId} key={`h2h-${refresh}`} />
          </div>

          {/* #6 · Cerrar categoría (motor vivo). El podio sale del top-3 de la tabla. */}
          {!closed && (
            <Button onClick={cerrar} disabled={closing} variant="outline" className="w-full">
              {closing ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Lock className="mr-1 h-4 w-4" /> Cerrar categoría</>}
            </Button>
          )}
          {showPodium && (
            <FrozenTableAnimation podiumNames={podium} onComplete={() => setShowPodium(false)} />
          )}
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
