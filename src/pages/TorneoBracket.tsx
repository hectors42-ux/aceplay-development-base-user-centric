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

interface CategoryRow { category_id: string; category_name: string; tournament_name: string; sport: string | null; enrolled: boolean; players: number; bracket_ready: boolean }
interface SlotRow {
  slot_id: string; round: number; slot: number;
  player_a: string | null; name_a: string | null;
  player_b: string | null; name_b: string | null;
  winner: string | null; status: string; match_id: string | null;
}

const ROUND_LABEL = (round: number, maxRound: number) => {
  const fromEnd = maxRound - round;
  if (fromEnd === 0) return "Final";
  if (fromEnd === 1) return "Semifinal";
  if (fromEnd === 2) return "Cuartos";
  return `Ronda ${round}`;
};

const TorneoBracket = () => {
  const { user } = useAuth();
  const [cats, setCats] = useState<CategoryRow[]>([]);
  const [catId, setCatId] = useState<string>("");
  const [slots, setSlots] = useState<SlotRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [playSlot, setPlaySlot] = useState<SlotRow | null>(null);
  const [result, setResult] = useState<"me" | "rival">("me");
  const [a, setA] = useState("6");
  const [b, setB] = useState("3");
  const [busy, setBusy] = useState(false);

  const loadBracket = useCallback(async (id: string) => {
    if (!id) return;
    setLoading(true);
    const { data } = await supabase.rpc("bracket_view", { _category_id: id });
    setSlots((data as SlotRow[] | null) ?? []);
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

  useEffect(() => { if (catId) void loadBracket(catId); }, [catId, loadBracket]);

  const maxRound = useMemo(() => slots.reduce((mx, s) => Math.max(mx, s.round), 1), [slots]);
  const rounds = useMemo(() => {
    const by: Record<number, SlotRow[]> = {};
    for (const s of slots) (by[s.round] ??= []).push(s);
    return Object.keys(by).map(Number).sort((x, y) => x - y).map((r) => ({ round: r, slots: by[r].sort((p, q) => p.slot - q.slot) }));
  }, [slots]);

  const champion = slots.find((s) => s.round === maxRound)?.winner
    ? slots.find((s) => s.round === maxRound)
    : null;

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
    toast.success("Resultado cargado. Cuando tu rival lo confirme, avanza el cuadro y se mueve el rating.");
    void loadBracket(catId);
  };

  const current = cats.find((c) => c.category_id === catId);

  return (
    <div className="mx-auto max-w-md px-5 py-6">
      <div className="mb-5 flex items-center gap-3">
        <Link to="/" className="flex h-9 w-9 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Torneo</p>
          <h1 className="font-display text-xl font-semibold">Cuadro</h1>
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
          {current.tournament_name} · {current.category_name} · {current.players} inscritos · eliminación simple
        </p>
      )}

      {champion?.winner && (
        <div className="mb-4 flex items-center gap-2 rounded-2xl border border-primary/40 bg-primary/10 p-4">
          <Trophy className="h-5 w-5 text-primary" />
          <p className="text-sm font-semibold">Campeón: {champion.winner === champion.player_a ? champion.name_a : champion.name_b}</p>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full rounded-2xl" />)}</div>
      ) : rounds.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
          No hay cuadro disponible.
        </p>
      ) : (
        <div className="space-y-5">
          {rounds.map(({ round, slots: rs }) => (
            <div key={round}>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{ROUND_LABEL(round, maxRound)}</p>
              <div className="space-y-2">
                {rs.map((s) => {
                  const iAmIn = s.player_a === user?.id || s.player_b === user?.id;
                  const canPlay = s.status === "playable" && iAmIn;
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
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          {s.status === "played" ? "Jugado" : s.status === "played_pending" ? "Esperando confirmación" : s.status === "bye" ? "Bye" : s.status === "playable" ? "Por jugar" : "Pendiente"}
                        </span>
                        {canPlay && !s.match_id && (
                          <Button size="sm" variant="clay" className="h-7" onClick={() => { setPlaySlot(s); setResult("me"); setA("6"); setB("3"); }}>
                            <Play className="h-3.5 w-3.5" /> Jugar
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
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
