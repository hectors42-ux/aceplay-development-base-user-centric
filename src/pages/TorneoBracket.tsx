import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Loader2, Trophy, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
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
  slot_id: string; round: number; slot: number;
  player_a: string | null; name_a: string | null;
  player_b: string | null; name_b: string | null;
  winner: string | null; status: string; match_id: string | null;
}
interface StandRow { pos: number | null; user_id: string; name: string | null; wins: number; played: number; set_diff: number; status: string }

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
  const [cats, setCats] = useState<CategoryRow[]>([]);
  const [catId, setCatId] = useState<string>("");
  const [slots, setSlots] = useState<SlotRow[]>([]);
  const [standings, setStandings] = useState<StandRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [playSlot, setPlaySlot] = useState<SlotRow | null>(null);
  const [result, setResult] = useState<"me" | "rival">("me");
  const [a, setA] = useState("6");
  const [b, setB] = useState("3");
  const [busy, setBusy] = useState(false);

  const current = cats.find((c) => c.category_id === catId);
  const isRoundRobin = current?.motor === "round_robin";

  const loadData = useCallback(async (id: string, motor: string | null) => {
    if (!id) return;
    setLoading(true);
    const [bk, st] = await Promise.all([
      supabase.rpc("bracket_view", { _category_id: id }),
      motor === "round_robin" ? supabase.rpc("tournament_standings", { _category_id: id }) : Promise.resolve({ data: [] }),
    ]);
    setSlots((bk.data as SlotRow[] | null) ?? []);
    setStandings((st.data as StandRow[] | null) ?? []);
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

  const maxRound = useMemo(() => slots.reduce((mx, s) => Math.max(mx, s.round), 1), [slots]);
  const rounds = useMemo(() => {
    const by: Record<number, SlotRow[]> = {};
    for (const s of slots) (by[s.round] ??= []).push(s);
    return Object.keys(by).map(Number).sort((x, y) => x - y).map((r) => ({ round: r, slots: by[r].sort((p, q) => p.slot - q.slot) }));
  }, [slots]);

  const championSlot = slots.find((s) => s.round === maxRound);
  const champion = !isRoundRobin && championSlot?.winner ? championSlot : null;
  const rrLeader = isRoundRobin && standings.length && standings[0].played > 0 ? standings[0] : null;

  const sendResult = async () => {
    if (!playSlot) return;
    setBusy(true);
    const sets = a !== "" && b !== "" ? [{ games_a: Number(a), games_b: Number(b) }] : [];
    const { error } = await supabase.rpc("play_bracket_match", {
      _slot_id: playSlot.slot_id, _winner_is_me: result === "me", _sets: sets,
    });
    setBusy(false);
    setPlaySlot(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Resultado cargado. Cuando tu rival lo confirme, se actualiza la tabla/cuadro y se mueve el rating.");
    void loadData(catId, current?.motor ?? null);
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

  return (
    <div className="mx-auto max-w-md px-5 py-6">
      <div className="mb-5 flex items-center gap-3">
        <Link to="/" className="flex h-9 w-9 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Torneo</p>
          <h1 className="font-display text-xl font-semibold">{isRoundRobin ? "Tabla" : "Cuadro"}</h1>
        </div>
      </div>

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
          {current.tournament_name} · {current.category_name} · {current.players} inscritos · {isRoundRobin ? "round robin" : "eliminación simple"}
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
          <Trophy className="h-5 w-5 text-primary" />
          <p className="text-sm font-semibold">Líder: {rrLeader.name}</p>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full rounded-2xl" />)}</div>
      ) : isRoundRobin ? (
        <>
          {/* Standings table */}
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
            <div className="grid grid-cols-[28px_1fr_36px_36px_40px] items-center gap-1 border-b border-border px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <span>#</span><span>Jugador</span><span className="text-center">PJ</span><span className="text-center">PG</span><span className="text-center">±Sets</span>
            </div>
            {standings.map((r) => (
              <div key={r.user_id} className={cn("grid grid-cols-[28px_1fr_36px_36px_40px] items-center gap-1 px-3 py-2 text-sm",
                r.user_id === user?.id && "bg-primary/5 font-semibold")}>
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
          {/* Fixtures */}
          <p className="mb-2 mt-5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Partidos</p>
          <div className="space-y-2">{slots.map(matchCard)}</div>
        </>
      ) : (
        <div className="space-y-5">
          {rounds.map(({ round, slots: rs }) => (
            <div key={round}>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{ROUND_LABEL(round, maxRound)}</p>
              <div className="space-y-2">{rs.map(matchCard)}</div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!playSlot} onOpenChange={(o) => { if (!o) setPlaySlot(null); }}>
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
