import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Loader2, Swords, ChevronsUp, Plus } from "lucide-react";
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

interface EscalerillaRow { space_id: string; name: string; sport: string | null; enrolled: boolean; my_rank: number | null; players: number }
interface StandingRow { local_rank: number; user_id: string; name: string | null; nivel: number | null; category: string | null; rating: number | null }

const Escalerilla = () => {
  const { user } = useAuth();
  const { canCreate } = useCanCreate();
  const [escalerillas, setEscalerillas] = useState<EscalerillaRow[]>([]);
  const [escId, setEscId] = useState<string>("");
  const [standings, setStandings] = useState<StandingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [challengeTo, setChallengeTo] = useState<StandingRow | null>(null);
  const [result, setResult] = useState<"me" | "rival">("me");
  const [setsA, setSetsA] = useState("6");
  const [setsB, setSetsB] = useState("4");
  const [busy, setBusy] = useState(false);

  const myRank = escalerillas.find((e) => e.space_id === escId)?.my_rank ?? null;

  const loadStandings = useCallback(async (id: string) => {
    if (!id) return;
    setLoading(true);
    const { data } = await supabase.rpc("ladder_standings", { _escalerilla_id: id });
    setStandings((data as StandingRow[] | null) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data } = await supabase.rpc("list_escalerillas");
      const rows = (data as EscalerillaRow[] | null) ?? [];
      setEscalerillas(rows);
      if (rows.length) setEscId(rows[0].space_id);
      else setLoading(false);
    })();
  }, [user]);

  useEffect(() => { if (escId) void loadStandings(escId); }, [escId, loadStandings]);

  const sendChallenge = async () => {
    if (!challengeTo) return;
    setBusy(true);
    const sets = setsA !== "" && setsB !== "" ? [{ games_a: Number(setsA), games_b: Number(setsB) }] : [];
    const { error } = await supabase.rpc("create_ladder_challenge", {
      _escalerilla_id: escId,
      _opponent: challengeTo.user_id,
      _winner_is_me: result === "me",
      _sets: sets,
    });
    setBusy(false);
    setChallengeTo(null);
    if (error) { toast.error(error.message); return; }
    toast.success(`Reto enviado a ${challengeTo.name}. Cuando lo confirme, se actualizan rating y posición.`);
  };

  const current = escalerillas.find((e) => e.space_id === escId);

  return (
    <div className="mx-auto max-w-md px-5 py-6">
      <div className="mb-5 flex items-center gap-3">
        <Link to="/" className="flex h-9 w-9 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Competir</p>
          <h1 className="font-display text-xl font-semibold">Escalerilla</h1>
        </div>
        {canCreate && (
          <Button size="sm" variant="clay" className="ml-auto" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> Crear
          </Button>
        )}
      </div>

      {escalerillas.length > 1 && (
        <div className="mb-4">
          <Select value={escId} onValueChange={setEscId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {escalerillas.map((e) => <SelectItem key={e.space_id} value={e.space_id}>{e.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      {current && (
        <p className="mb-3 text-xs text-muted-foreground">
          {current.name} · {current.players} jugadores
          {myRank ? <> · vas <span className="font-semibold text-foreground">#{myRank}</span></> : <> · no estás inscrito</>}
        </p>
      )}

      {loading ? (
        <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full rounded-2xl" />)}</div>
      ) : standings.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
          No hay escalerillas disponibles.
        </p>
      ) : (
        <div className="space-y-2">
          {standings.map((s) => {
            const isMe = s.user_id === user?.id;
            const canChallenge = myRank != null && s.local_rank < myRank && !isMe;
            return (
              <div key={s.user_id}
                className={cn("flex items-center gap-3 rounded-2xl border bg-card p-3 shadow-card",
                  isMe ? "border-primary ring-1 ring-primary/30" : "border-border")}>
                <span className="w-7 text-center font-display text-lg font-bold text-foreground">#{s.local_rank}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {s.name} {isMe && <span className="text-[10px] font-bold text-primary">· TÚ</span>}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {s.category ?? "—"} · nivel {s.nivel != null ? Number(s.nivel).toFixed(2) : "—"}
                  </p>
                </div>
                {canChallenge && (
                  <Button size="sm" variant="outline" onClick={() => { setChallengeTo(s); setResult("me"); setSetsA("6"); setSetsB("4"); }}>
                    <Swords className="h-4 w-4" /> Retar
                  </Button>
                )}
                {isMe && myRank && myRank > 1 && <ChevronsUp className="h-4 w-4 text-primary" aria-label="Puedes retar hacia arriba" />}
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-4 text-center text-[11px] text-muted-foreground">
        Reta a alguien por encima tuyo. El resultado solo cuenta cuando el rival lo confirma; ahí suben/bajan el rating global y la posición local.
      </p>

      <CreateSpaceDialog
        kind="escalerilla"
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(id) => {
          void (async () => {
            const { data } = await supabase.rpc("list_escalerillas");
            setEscalerillas((data as EscalerillaRow[] | null) ?? []);
            setEscId(id);
          })();
        }}
      />

      {/* Challenge dialog */}
      <Dialog open={!!challengeTo} onOpenChange={(o) => { if (!o) setChallengeTo(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Retar a {challengeTo?.name} (#{challengeTo?.local_rank})</DialogTitle></DialogHeader>
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
                <Input type="number" min={0} max={20} value={setsA} className="w-16" onChange={(e) => setSetsA(e.target.value)} />
                <span className="text-muted-foreground">-</span>
                <Input type="number" min={0} max={20} value={setsB} className="w-16" onChange={(e) => setSetsB(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChallengeTo(null)}>Cancelar</Button>
            <Button variant="clay" disabled={busy} onClick={sendChallenge}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar reto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Escalerilla;
