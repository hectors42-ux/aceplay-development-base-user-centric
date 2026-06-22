import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Loader2, Trophy, Play, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import { useCanCreate } from "@/hooks/useCanCreate";
import { CreateSpaceDialog } from "@/components/CreateSpaceDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface CategoryRow { category_id: string; category_name: string; tournament_name: string; sport: string | null; motor: string | null; enrolled: boolean; players: number; bracket_ready: boolean }
interface SlotRow {
  slot_id: string; bracket: string; round: number; slot: number;
  player_a: string | null; name_a: string | null;
  player_b: string | null; name_b: string | null;
  winner: string | null; status: string; match_id: string | null;
}
interface StandRow { grp?: string; pos: number | null; user_id: string; name: string | null; wins: number; played: number; set_diff: number; status: string }
interface AmRow { slot_id: string; round: number; status: string; match_id: string | null; team_a: string[] | null; team_b: string[] | null; team_a_ids: string[] | null; team_b_ids: string[] | null; winner_side: string | null }
interface AmStand { pos: number | null; user_id: string; name: string | null; points: number; played: number }

const ROUND_LABEL = (round: number, maxRound: number) => {
  const fromEnd = maxRound - round;
  if (fromEnd === 0) return "Final";
  if (fromEnd === 1) return "Semifinal";
  if (fromEnd === 2) return "Cuartos";
  return `Ronda ${round}`;
};

const STATUS_LABEL: Record<string, string> = {
  played: "Jugado", played_pending: "Esperando confirmación", bye: "Bye", playable: "Por jugar", pending: "Pendiente",
};

const TorneoBracket = () => {
  const { user } = useAuth();
  const { canCreate } = useCanCreate();
  const [createOpen, setCreateOpen] = useState(false);
  const [cats, setCats] = useState<CategoryRow[]>([]);
  const [catId, setCatId] = useState<string>("");
  const [slots, setSlots] = useState<SlotRow[]>([]);
  const [standings, setStandings] = useState<StandRow[]>([]);
  const [groupStands, setGroupStands] = useState<StandRow[]>([]);
  const [amRounds, setAmRounds] = useState<AmRow[]>([]);
  const [amStands, setAmStands] = useState<AmStand[]>([]);
  const [amPlayId, setAmPlayId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [playSlot, setPlaySlot] = useState<SlotRow | null>(null);
  const [result, setResult] = useState<"me" | "rival">("me");
  const [a, setA] = useState("6");
  const [b, setB] = useState("3");
  const [busy, setBusy] = useState(false);

  const current = cats.find((c) => c.category_id === catId);
  const motor = current?.motor ?? "single_elimination";
  const isRoundRobin = motor === "round_robin";
  const isGroups = motor === "groups_playoff";
  const isDoubleElim = motor === "double_elimination";
  const isAmericano = motor === "americano";

  const loadData = useCallback(async (id: string, m: string | null) => {
    if (!id) return;
    setLoading(true);
    const [bk, st, gs, av, asd] = await Promise.all([
      supabase.rpc("bracket_view", { _category_id: id }),
      m === "round_robin" ? supabase.rpc("tournament_standings", { _category_id: id }) : Promise.resolve({ data: [] }),
      m === "groups_playoff" ? supabase.rpc("group_standings", { _category_id: id }) : Promise.resolve({ data: [] }),
      m === "americano" ? supabase.rpc("americano_view", { _category_id: id }) : Promise.resolve({ data: [] }),
      m === "americano" ? supabase.rpc("americano_standings", { _category_id: id }) : Promise.resolve({ data: [] }),
    ]);
    setSlots((bk.data as SlotRow[] | null) ?? []);
    setStandings((st.data as StandRow[] | null) ?? []);
    setGroupStands((gs.data as StandRow[] | null) ?? []);
    setAmRounds((av.data as AmRow[] | null) ?? []);
    setAmStands((asd.data as AmStand[] | null) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data } = await supabase.rpc("list_tournament_categories");
      const rows = (data as CategoryRow[] | null) ?? [];
      setCats(rows);
      if (rows.length) setCatId(rows[0].category_id);
      else setLoading(false);
    })();
  }, [user]);

  useEffect(() => {
    if (catId) void loadData(catId, cats.find((c) => c.category_id === catId)?.motor ?? null);
  }, [catId, cats, loadData]);

  const mainSlots = useMemo(() => slots.filter((s) => (s.bracket ?? "main") === "main"), [slots]);
  const consoSlots = useMemo(() => slots.filter((s) => s.bracket === "consolation"), [slots]);
  const playoffSlots = useMemo(() => slots.filter((s) => s.bracket === "playoff"), [slots]);
  const winnersSlots = useMemo(() => slots.filter((s) => s.bracket === "winners"), [slots]);
  const losersSlots = useMemo(() => slots.filter((s) => s.bracket === "losers"), [slots]);
  const gfSlots = useMemo(() => slots.filter((s) => s.bracket === "grand_final"), [slots]);
  const maxRound = useMemo(() => mainSlots.reduce((mx, s) => Math.max(mx, s.round), 1), [mainSlots]);

  const championSlot = mainSlots.find((s) => s.round === maxRound);
  const champion = !isRoundRobin && !isGroups && !isDoubleElim && championSlot?.winner ? championSlot : null;
  const rrLeader = isRoundRobin && standings.length && standings[0].played > 0 ? standings[0] : null;

  const sendResult = async () => {
    const sid = playSlot?.slot_id ?? amPlayId;
    if (!sid) return;
    setBusy(true);
    const sets = a !== "" && b !== "" ? [{ games_a: Number(a), games_b: Number(b) }] : [];
    const { error } = await supabase.rpc("play_bracket_match", { _slot_id: sid, _winner_is_me: result === "me", _sets: sets });
    setBusy(false);
    setPlaySlot(null);
    setAmPlayId(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Resultado cargado. Cuando tu rival lo confirme, se actualiza la tabla/cuadro y se mueve el rating.");
    void loadData(catId, motor);
  };

  const playButton = (s: SlotRow) => {
    const iAmIn = s.player_a === user?.id || s.player_b === user?.id;
    if (s.status !== "playable" || !iAmIn || s.match_id) return null;
    return (
      <Button size="sm" variant="clay" className="h-7" onClick={() => { setPlaySlot(s); setResult("me"); setA("6"); setB("3"); }}>
        <Play className="h-3.5 w-3.5" /> Jugar
      </Button>
    );
  };

  const matchCard = (s: SlotRow) => {
    const iAmIn = s.player_a === user?.id || s.player_b === user?.id;
    const sideRow = (pid: string | null, name: string | null) => (
      <div className={cn("flex items-center justify-between px-3 py-1.5",
        s.winner && s.winner === pid && "font-semibold text-foreground",
        s.winner && pid && s.winner !== pid && "text-muted-foreground line-through")}>
        <span className="truncate text-sm">{name ?? <span className="text-muted-foreground/60">—</span>}</span>
        {s.winner === pid && pid && <Trophy className="h-3.5 w-3.5 text-primary" />}
      </div>
    );
    return (
      <div key={s.slot_id} className={cn("rounded-2xl border bg-card shadow-card", iAmIn ? "border-primary/40" : "border-border")}>
        {sideRow(s.player_a, s.name_a)}
        <div className="mx-3 border-t border-border" />
        {sideRow(s.player_b, s.name_b)}
        <div className="flex items-center justify-between px-3 py-1.5">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{STATUS_LABEL[s.status] ?? s.status}</span>
          {playButton(s)}
        </div>
      </div>
    );
  };

  const standTable = (rows: StandRow[]) => (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
      <div className="grid grid-cols-[28px_1fr_36px_36px_40px] items-center gap-1 border-b border-border px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <span>#</span><span>Jugador</span><span className="text-center">PJ</span><span className="text-center">PG</span><span className="text-center">±Sets</span>
      </div>
      {rows.map((r) => (
        <div key={r.user_id} className={cn("grid grid-cols-[28px_1fr_36px_36px_40px] items-center gap-1 px-3 py-2 text-sm",
          r.user_id === user?.id && "bg-primary/5 font-semibold", r.status === "playoff" && "bg-success/5")}>
          <span className="text-muted-foreground">{r.pos ?? "—"}</span>
          <span className="truncate">{r.name} {r.user_id === user?.id && <span className="text-[10px] text-primary">· TÚ</span>}</span>
          <span className="text-center tabular-nums text-muted-foreground">{r.played}</span>
          <span className="text-center font-display font-bold tabular-nums">{r.wins}</span>
          <span className={cn("text-center tabular-nums", r.set_diff > 0 ? "text-success" : r.set_diff < 0 ? "text-destructive" : "text-muted-foreground")}>
            {r.set_diff > 0 ? `+${r.set_diff}` : r.set_diff}
          </span>
        </div>
      ))}
    </div>
  );

  const amStandTable = (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
      <div className="grid grid-cols-[28px_1fr_44px_36px] items-center gap-1 border-b border-border px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <span>#</span><span>Jugador</span><span className="text-center">Pts</span><span className="text-center">PJ</span>
      </div>
      {amStands.map((r) => (
        <div key={r.user_id} className={cn("grid grid-cols-[28px_1fr_44px_36px] items-center gap-1 px-3 py-2 text-sm", r.user_id === user?.id && "bg-primary/5 font-semibold")}>
          <span className="text-muted-foreground">{r.pos ?? "—"}</span>
          <span className="truncate">{r.name} {r.user_id === user?.id && <span className="text-[10px] text-primary">· TÚ</span>}</span>
          <span className="text-center font-display font-bold tabular-nums">{r.points}</span>
          <span className="text-center tabular-nums text-muted-foreground">{r.played}</span>
        </div>
      ))}
    </div>
  );

  const amCard = (r: AmRow) => {
    const iAmIn = !!(user?.id && (r.team_a_ids?.includes(user.id) || r.team_b_ids?.includes(user.id)));
    const teamRow = (names: string[] | null, side: "a" | "b") => (
      <div className={cn("flex items-center justify-between px-3 py-1.5",
        r.winner_side === side && "font-semibold text-foreground",
        r.winner_side && r.winner_side !== side && "text-muted-foreground line-through")}>
        <span className="truncate text-sm">{names?.join(" + ") ?? <span className="text-muted-foreground/60">—</span>}</span>
        {r.winner_side === side && <Trophy className="h-3.5 w-3.5 text-primary" />}
      </div>
    );
    return (
      <div key={r.slot_id} className={cn("rounded-2xl border bg-card shadow-card", iAmIn ? "border-primary/40" : "border-border")}>
        {teamRow(r.team_a, "a")}
        <div className="mx-3 border-t border-border" />
        {teamRow(r.team_b, "b")}
        <div className="flex items-center justify-between px-3 py-1.5">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{STATUS_LABEL[r.status] ?? r.status}</span>
          {r.status === "playable" && iAmIn && !r.match_id && (
            <Button size="sm" variant="clay" className="h-7" onClick={() => { setAmPlayId(r.slot_id); setResult("me"); setA("6"); setB("3"); }}>
              <Play className="h-3.5 w-3.5" /> Jugar
            </Button>
          )}
        </div>
      </div>
    );
  };

  const renderRounds = (subset: SlotRow[]) => {
    const mr = subset.reduce((mx, s) => Math.max(mx, s.round), 1);
    const by: Record<number, SlotRow[]> = {};
    for (const s of subset) (by[s.round] ??= []).push(s);
    return Object.keys(by).map(Number).sort((x, y) => x - y).map((r) => (
      <div key={r}>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{ROUND_LABEL(r, mr)}</p>
        <div className="space-y-2">{by[r].sort((p, q) => p.slot - q.slot).map(matchCard)}</div>
      </div>
    ));
  };

  const title = isRoundRobin ? "Tabla" : isGroups ? "Grupos" : isAmericano ? "Americano" : "Cuadro";
  const formatLabel = isRoundRobin ? "round robin" : isGroups ? "grupos → playoff" : isDoubleElim ? "doble eliminación" : isAmericano ? "americano de rotación" : consoSlots.length ? "consolación" : "eliminación simple";
  const amLeader = isAmericano && amStands.length && amStands[0].played > 0 ? amStands[0] : null;

  return (
    <div className="mx-auto max-w-md px-5 py-6">
      <div className="mb-5 flex items-center gap-3">
        <Link to="/" className="flex h-9 w-9 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Torneo</p>
          <h1 className="font-display text-xl font-semibold">{title}</h1>
        </div>
        {canCreate && (
          <Button size="sm" variant="clay" className="ml-auto" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> Crear
          </Button>
        )}
      </div>

      <CreateSpaceDialog
        kind="tournament"
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => {
          void (async () => {
            const prevIds = new Set(cats.map((c) => c.category_id));
            const { data } = await supabase.rpc("list_tournament_categories");
            const rows = (data as CategoryRow[] | null) ?? [];
            setCats(rows);
            const fresh = rows.find((r) => !prevIds.has(r.category_id));
            if (fresh) setCatId(fresh.category_id);
          })();
        }}
      />

      {cats.length > 1 && (
        <div className="mb-4">
          <Select value={catId} onValueChange={setCatId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {cats.map((c) => <SelectItem key={c.category_id} value={c.category_id}>{c.tournament_name} · {c.category_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      {current && (
        <p className="mb-4 text-xs text-muted-foreground">
          {current.tournament_name} · {current.category_name} · {current.players} inscritos · {formatLabel}
        </p>
      )}

      {champion?.winner && (
        <div className="mb-4 flex items-center gap-2 rounded-2xl border border-primary/40 bg-primary/10 p-4">
          <Trophy className="h-5 w-5 text-primary" />
          <p className="text-sm font-semibold">Campeón: {champion.winner === champion.player_a ? champion.name_a : champion.name_b}</p>
        </div>
      )}
      {rrLeader && (
        <div className="mb-4 flex items-center gap-2 rounded-2xl border border-primary/40 bg-primary/10 p-4">
          <Trophy className="h-5 w-5 text-primary" /><p className="text-sm font-semibold">Líder: {rrLeader.name}</p>
        </div>
      )}
      {amLeader && (
        <div className="mb-4 flex items-center gap-2 rounded-2xl border border-primary/40 bg-primary/10 p-4">
          <Trophy className="h-5 w-5 text-primary" /><p className="text-sm font-semibold">Líder: {amLeader.name} · {amLeader.points} pts</p>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full rounded-2xl" />)}</div>
      ) : isRoundRobin ? (
        <>
          {standTable(standings)}
          <p className="mb-2 mt-5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Partidos</p>
          <div className="space-y-2">{slots.map(matchCard)}</div>
        </>
      ) : isGroups ? (
        <div className="space-y-6">
          {["A", "B"].map((g) => (
            <div key={g}>
              <p className="mb-2 text-sm font-semibold text-foreground">Grupo {g}</p>
              {standTable(groupStands.filter((r) => r.grp === g))}
              <div className="mt-2 space-y-2">{slots.filter((s) => s.bracket === `group_${g.toLowerCase()}`).map(matchCard)}</div>
            </div>
          ))}
          <div>
            <p className="mb-3 text-sm font-semibold text-foreground">Playoff</p>
            {playoffSlots.some((s) => s.player_a || s.player_b)
              ? <div className="space-y-5">{renderRounds(playoffSlots)}</div>
              : <p className="rounded-2xl border border-dashed border-border bg-card p-4 text-center text-xs text-muted-foreground">Se define al terminar la fase de grupos (cruce 1A-2B / 1B-2A).</p>}
          </div>
        </div>
      ) : isDoubleElim ? (
        <div className="space-y-6">
          <div>
            <p className="mb-2 text-sm font-semibold text-foreground">Winners bracket</p>
            <div className="space-y-5">{renderRounds(winnersSlots)}</div>
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold text-foreground">Losers bracket</p>
            {losersSlots.some((s) => s.player_a || s.player_b)
              ? <div className="space-y-2">{losersSlots.map(matchCard)}</div>
              : <p className="rounded-2xl border border-dashed border-border bg-card p-4 text-center text-xs text-muted-foreground">Se llena con los que pierden en el winners.</p>}
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold text-foreground">Gran final</p>
            {gfSlots.some((s) => s.player_a || s.player_b)
              ? <div className="space-y-2">{gfSlots.filter((s) => s.player_a || s.player_b).map(matchCard)}</div>
              : <p className="rounded-2xl border border-dashed border-border bg-card p-4 text-center text-xs text-muted-foreground">Ganador del winners vs ganador del losers (con reset si hace falta).</p>}
          </div>
        </div>
      ) : isAmericano ? (
        <div className="space-y-5">
          {amStandTable}
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Rondas</p>
            <div className="space-y-3">
              {amRounds.map((r) => (
                <div key={r.slot_id}>
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Ronda {r.round}</p>
                  {amCard(r)}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {consoSlots.length > 0 && <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Cuadro principal</p>}
          <div className="space-y-5">{renderRounds(mainSlots)}</div>
          {consoSlots.length > 0 && (
            <div>
              <p className="mb-3 mt-2 text-sm font-semibold text-foreground">Consolación · cuadro B</p>
              <div className="space-y-5">{renderRounds(consoSlots)}</div>
            </div>
          )}
        </div>
      )}

      <Dialog open={!!playSlot || !!amPlayId} onOpenChange={(o) => { if (!o) { setPlaySlot(null); setAmPlayId(null); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Cargar resultado</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Resultado</Label>
              <Select value={result} onValueChange={(v) => setResult(v as "me" | "rival")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="me">Gané yo</SelectItem>
                  <SelectItem value="rival">Ganó el rival</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Score (opcional)</Label>
              <div className="flex items-center gap-2">
                <Input type="number" min={0} max={20} value={a} className="w-16" onChange={(e) => setA(e.target.value)} />
                <span className="text-muted-foreground">-</span>
                <Input type="number" min={0} max={20} value={b} className="w-16" onChange={(e) => setB(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPlaySlot(null)}>Cancelar</Button>
            <Button variant="clay" disabled={busy} onClick={sendResult}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cargar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TorneoBracket;
