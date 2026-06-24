import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Loader2, Check, Flag, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/avatar/UserAvatar";
import { MatchScore } from "@/components/arena";
import { CoinHud } from "@/components/home/CoinHud";
import { toast } from "sonner";

interface SpaceRow { space_id: string; name: string; sport: string | null; type: string }
interface RosterRow { user_id: string; name: string | null; avatar_url: string | null; avatar_kind: string | null; avatar_look: string | null }
interface PendingRow {
  match_id: string;
  space_id: string;
  sport: string;
  format: string;
  recorder_name: string | null;
  recorder_avatar_url: string | null;
  recorder_avatar_kind: string | null;
  recorder_avatar_look: string | null;
  i_won: boolean;
  played_at: string;
  score: { a: number; b: number }[];
}

// sport+format options offered when the space itself is sport-agnostic (e.g. a club).
const SPORT_OPTIONS = [
  { value: "tennis|singles", label: "Tenis · Singles" },
  { value: "padel|doubles", label: "Pádel · Dobles" },
];

const CargarResultado = () => {
  const { user } = useAuth();

  // ---- Pending confirmations (inbox) ----
  const [pending, setPending] = useState<PendingRow[]>([]);
  const [pendingLoading, setPendingLoading] = useState(true);
  const [busyMatch, setBusyMatch] = useState<string | null>(null);
  const [disputeFor, setDisputeFor] = useState<string | null>(null);
  const [disputeReason, setDisputeReason] = useState("");

  const loadPending = useCallback(async () => {
    setPendingLoading(true);
    const { data, error } = await supabase.rpc("pending_confirmations");
    if (error) console.error("[pending_confirmations]", error);
    setPending((data as PendingRow[] | null) ?? []);
    setPendingLoading(false);
  }, []);

  // ---- Record form ----
  const [spaces, setSpaces] = useState<SpaceRow[]>([]);
  const [spaceId, setSpaceId] = useState<string>("");
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [opponentId, setOpponentId] = useState<string>("");
  const [sportFmt, setSportFmt] = useState<string>("padel|doubles");
  const [winner, setWinner] = useState<"me" | "rival">("me");
  const [sets, setSets] = useState<{ a: string; b: string }[]>([{ a: "", b: "" }]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    void loadPending();
    void (async () => {
      const { data } = await supabase.rpc("my_match_spaces");
      const rows = (data as SpaceRow[] | null) ?? [];
      setSpaces(rows);
      if (rows.length) setSpaceId(rows[0].space_id);
    })();
  }, [user, loadPending]);

  useEffect(() => {
    if (!spaceId) { setRoster([]); setOpponentId(""); return; }
    void (async () => {
      const { data } = await supabase.rpc("space_roster", { _space_id: spaceId });
      const rows = (data as RosterRow[] | null) ?? [];
      setRoster(rows);
      setOpponentId(rows[0]?.user_id ?? "");
    })();
    // If the space declares a sport, lock the picker to it.
    const sp = spaces.find((s) => s.space_id === spaceId);
    if (sp?.sport === "tennis") setSportFmt("tennis|singles");
    else if (sp?.sport === "padel") setSportFmt("padel|doubles");
  }, [spaceId, spaces]);

  const submit = async () => {
    if (!spaceId || !opponentId) {
      toast.error("Elige espacio y rival");
      return;
    }
    setSubmitting(true);
    const [sport, format] = sportFmt.split("|");
    const cleanSets = sets
      .filter((s) => s.a !== "" && s.b !== "")
      .map((s) => ({ games_a: Number(s.a), games_b: Number(s.b) }));
    const { error } = await supabase.rpc("record_match", {
      _space_id: spaceId,
      _sport: sport,
      _format: format,
      _opponent: opponentId,
      _winner_is_me: winner === "me",
      _sets: cleanSets,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Partido registrado. Pendiente de que tu rival lo confirme.");
    setSets([{ a: "", b: "" }]);
  };

  const confirm = async (matchId: string) => {
    setBusyMatch(matchId);
    const { data, error } = await supabase.rpc("confirm_match", { _match_id: matchId });
    setBusyMatch(null);
    if (error) { toast.error(error.message); return; }
    const delta = (data as { delta?: number } | null)?.delta ?? 0;
    const sign = delta >= 0 ? "+" : "";
    toast.success(`Confirmado. Tu rating: ${sign}${delta}`, { duration: 6000 });
    void loadPending();
  };

  const sendDispute = async () => {
    if (!disputeFor) return;
    setBusyMatch(disputeFor);
    const { error } = await supabase.rpc("dispute_match", {
      _match_id: disputeFor,
      _reason: disputeReason,
    });
    setBusyMatch(null);
    setDisputeFor(null);
    setDisputeReason("");
    if (error) { toast.error(error.message); return; }
    toast.success("Partido disputado. No afectará el rating.");
    void loadPending();
  };

  return (
    <div className="mx-auto max-w-md px-5 py-6">
      <CoinHud className="mb-5" />
      <div className="mb-5 flex items-center gap-3">
        <Link to="/ranking" className="flex h-9 w-9 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Resultados</p>
          <h1 className="font-display text-xl font-semibold">Cargar partido</h1>
        </div>
      </div>

      {/* Inbox: por confirmar */}
      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold text-foreground">Por confirmar</h2>
        {pendingLoading ? (
          <Skeleton className="h-20 w-full rounded-2xl" />
        ) : pending.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-card p-4 text-center text-xs text-muted-foreground">
            No tienes partidos por confirmar.
          </p>
        ) : (
          <div className="space-y-2.5">
            {pending.map((p) => (
              <div key={p.match_id} className="rounded-2xl border border-border bg-card p-4 shadow-card">
                <div className="flex items-center justify-between">
                  <div className="flex min-w-0 items-center gap-2">
                    <UserAvatar kind={p.recorder_avatar_kind} look={p.recorder_avatar_look} url={p.recorder_avatar_url} name={p.recorder_name} className="h-8 w-8" />
                    <p className="truncate text-sm font-semibold">{p.recorder_name ?? "Rival"} cargó un partido</p>
                  </div>
                  <span className="shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground">
                    {p.sport === "padel" ? "Pádel" : "Tenis"}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-3">
                  <MatchScore sets={p.score} />
                  <span className="text-xs text-muted-foreground">
                    te registró como{" "}
                    <span className={p.i_won ? "text-confirm font-medium" : "text-destructive font-medium"}>
                      {p.i_won ? "ganador" : "perdedor"}
                    </span>
                  </span>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="confirm" className="flex-1" disabled={busyMatch === p.match_id} onClick={() => confirm(p.match_id)}>
                    {busyMatch === p.match_id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4" /> Confirmar</>}
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1" disabled={busyMatch === p.match_id} onClick={() => { setDisputeFor(p.match_id); setDisputeReason(""); }}>
                    <Flag className="h-4 w-4" /> Disputar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Form: registrar */}
      <section className="rounded-3xl border border-border bg-card p-5 shadow-card">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
          <Trophy className="h-4 w-4 text-primary" /> Registrar resultado
        </h2>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Espacio</Label>
            <Select value={spaceId} onValueChange={setSpaceId}>
              <SelectTrigger><SelectValue placeholder="Elige un espacio" /></SelectTrigger>
              <SelectContent>
                {spaces.map((s) => <SelectItem key={s.space_id} value={s.space_id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Deporte</Label>
            <Select value={sportFmt} onValueChange={setSportFmt}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SPORT_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Rival</Label>
            <Select value={opponentId} onValueChange={setOpponentId}>
              <SelectTrigger><SelectValue placeholder="Elige un rival" /></SelectTrigger>
              <SelectContent>
                {roster.map((r) => (
                  <SelectItem key={r.user_id} value={r.user_id}>
                    <span className="flex items-center gap-2">
                      <UserAvatar kind={r.avatar_kind} look={r.avatar_look} url={r.avatar_url} name={r.name} className="h-5 w-5" />
                      {r.name ?? "Jugador"}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {roster.length === 0 && spaceId && (
              <p className="text-[11px] text-muted-foreground">No hay otros jugadores en este espacio.</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>¿Quién ganó?</Label>
            <Select value={winner} onValueChange={(v) => setWinner(v as "me" | "rival")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="me">Gané yo</SelectItem>
                <SelectItem value="rival">Ganó el rival</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Score (opcional)</Label>
            <div className="space-y-2">
              {sets.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-10 text-xs text-muted-foreground">Set {i + 1}</span>
                  <Input type="number" min={0} max={20} value={s.a} placeholder="0"
                    className="w-16" onChange={(e) => setSets((p) => p.map((x, j) => j === i ? { ...x, a: e.target.value } : x))} />
                  <span className="text-muted-foreground">-</span>
                  <Input type="number" min={0} max={20} value={s.b} placeholder="0"
                    className="w-16" onChange={(e) => setSets((p) => p.map((x, j) => j === i ? { ...x, b: e.target.value } : x))} />
                </div>
              ))}
              {sets.length < 3 && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setSets((p) => [...p, { a: "", b: "" }])}>
                  + Añadir set
                </Button>
              )}
            </div>
          </div>

          <Button variant="clay" size="lg" className="mt-1 w-full" disabled={submitting} onClick={submit}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Registrar partido"}
          </Button>
          <p className="text-center text-[11px] text-muted-foreground">
            El rating solo se mueve cuando tu rival confirma el partido.
          </p>
        </div>
      </section>

      {/* Dispute dialog */}
      <Dialog open={!!disputeFor} onOpenChange={(o) => { if (!o) setDisputeFor(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Disputar partido</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Cuéntale a tu rival qué está mal. El partido no afectará el rating.</p>
          <Input value={disputeReason} onChange={(e) => setDisputeReason(e.target.value)} placeholder="Motivo (ej. el marcador no es correcto)" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisputeFor(null)}>Cancelar</Button>
            <Button variant="destructive" disabled={busyMatch === disputeFor} onClick={sendDispute}>Disputar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CargarResultado;
