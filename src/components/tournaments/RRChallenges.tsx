import { useState } from "react";
import { Swords, Check, X, Clock, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRRChallenges, type RRChallenge } from "@/hooks/useRRChallenges";
import { cn } from "@/lib/utils";

export interface RivalLite { id: string; name: string; claimed: boolean }

type SetRow = { a: string; b: string; tb: boolean };
const empty = (): SetRow[] => [{ a: "", b: "", tb: false }, { a: "", b: "", tb: false }, { a: "", b: "", tb: false }];
const buildSets = (rows: SetRow[]) =>
  rows.filter((r) => r.a !== "" && r.b !== "").map((r) => ({ games_a: Number(r.a), games_b: Number(r.b), is_tiebreak: r.tb }));
const fmtSets = (sets: RRChallenge["proposed_sets"]) =>
  (sets ?? []).map((s) => `${s.games_a}-${s.games_b}`).join(" ");

// Reto vivo del torneo (solo participantes con cuenta). Mis retos con acciones por
// estado + lista para retar. Al confirmar, suma a la tabla (no al rating global).
export function RRChallenges({ categoryId, myId, rivals }: { categoryId: string; myId?: string; rivals: RivalLite[] }) {
  const { challenges, send, respond, record, confirm } = useRRChallenges(categoryId);
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [winnerSide, setWinnerSide] = useState<"me" | "rival">("me");
  const [sets, setSets] = useState<SetRow[]>(empty());

  if (!myId) return null;
  const openIds = new Set(challenges.map((c) => c.rival));
  const toChallenge = rivals.filter((r) => !openIds.has(r.id)); // sin reto en curso

  const startRecord = (id: string) => { setRecordingId(id); setWinnerSide("me"); setSets(empty()); };
  const submitRecord = (c: RRChallenge) => {
    const built = buildSets(sets);
    if (built.length === 0) return;
    record.mutate({ id: c.id, winner: winnerSide === "me" ? myId : c.rival, sets: built });
    setRecordingId(null);
  };

  return (
    <div className="space-y-4">
      {/* Mis retos activos */}
      {challenges.length > 0 && (
        <section>
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-action">
            <Swords className="h-3.5 w-3.5" /> Mis retos · {challenges.length}
          </p>
          <div className="space-y-2">
            {challenges.map((c) => (
              <div key={c.id} className="rounded-2xl border border-border bg-card p-3 shadow-card">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-foreground">{c.rival_name}</span>
                  <StatusPill c={c} />
                </div>
                {c.slot && <p className="mt-0.5 text-[11px] text-muted-foreground">{c.slot}</p>}

                {/* PENDIENTE */}
                {c.status === "pending" && (
                  <div className="mt-2 flex items-center gap-2">
                    {c.i_am_challenger ? (
                      <Button size="sm" variant="ghost" className="h-7 text-muted-foreground" onClick={() => respond.mutate({ id: c.id, action: "cancel" })}>Cancelar</Button>
                    ) : (
                      <>
                        <Button size="sm" variant="clay" className="h-7 gap-1" onClick={() => respond.mutate({ id: c.id, action: "accept" })}><Check className="h-3.5 w-3.5" /> Aceptar</Button>
                        <Button size="sm" variant="ghost" className="h-7 text-muted-foreground" onClick={() => respond.mutate({ id: c.id, action: "decline" })}><X className="h-3.5 w-3.5" /> Rechazar</Button>
                      </>
                    )}
                  </div>
                )}

                {/* ACEPTADO → cargar resultado */}
                {c.status === "accepted" && (
                  recordingId === c.id ? (
                    <div className="mt-2 space-y-2">
                      <div className="flex gap-1.5">
                        {(["me", "rival"] as const).map((s) => (
                          <button key={s} type="button" onClick={() => setWinnerSide(s)}
                            className={cn("flex-1 rounded-lg border px-2 py-1 text-xs font-semibold", winnerSide === s ? "border-skill bg-skill/10 text-skill" : "border-border text-muted-foreground")}>
                            Gana {s === "me" ? "yo" : c.rival_name}
                          </button>
                        ))}
                      </div>
                      {sets.map((r, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="w-12 text-[11px] text-muted-foreground">Set {i + 1}</span>
                          <Input type="number" min={0} max={20} value={r.a} className="h-8 w-14" onChange={(e) => setSets(sets.map((x, j) => j === i ? { ...x, a: e.target.value } : x))} />
                          <span className="text-muted-foreground">-</span>
                          <Input type="number" min={0} max={20} value={r.b} className="h-8 w-14" onChange={(e) => setSets(sets.map((x, j) => j === i ? { ...x, b: e.target.value } : x))} />
                          {i === 2 && (
                            <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
                              <input type="checkbox" checked={r.tb} onChange={(e) => setSets(sets.map((x, j) => j === i ? { ...x, tb: e.target.checked } : x))} /> super TB
                            </label>
                          )}
                        </div>
                      ))}
                      <div className="flex gap-2">
                        <Button size="sm" className="h-7 bg-action text-action-foreground hover:bg-action/90" onClick={() => submitRecord(c)}>Cargar</Button>
                        <Button size="sm" variant="ghost" className="h-7 text-muted-foreground" onClick={() => setRecordingId(null)}>Cancelar</Button>
                      </div>
                    </div>
                  ) : (
                    <Button size="sm" variant="clay" className="mt-2 h-7" onClick={() => startRecord(c.id)}>Cargar resultado</Button>
                  )
                )}

                {/* CARGADO → confirmar (el otro) o esperar */}
                {c.status === "recorded" && (
                  <div className="mt-2">
                    <p className="text-xs text-muted-foreground">Resultado propuesto: <span className="font-mono text-foreground">{fmtSets(c.proposed_sets)}</span> · gana {c.proposed_winner === myId ? "rival" : c.proposed_winner === c.rival ? c.rival_name : "—"}</p>
                    {c.recorded_by_me ? (
                      <p className="mt-1 text-[11px] text-muted-foreground">Esperando que {c.rival_name} confirme.</p>
                    ) : (
                      <div className="mt-2 flex gap-2">
                        <Button size="sm" variant="clay" className="h-7 gap-1" onClick={() => confirm.mutate({ id: c.id, agree: true })}><Check className="h-3.5 w-3.5" /> Confirmar</Button>
                        <Button size="sm" variant="ghost" className="h-7 text-muted-foreground" onClick={() => confirm.mutate({ id: c.id, agree: false })}>No coincide</Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Retar (rivales sin reto en curso) */}
      {toChallenge.length > 0 && (
        <section>
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Clock className="h-3.5 w-3.5" /> Por jugar · {toChallenge.length}
          </p>
          <div className="space-y-1.5">
            {toChallenge.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2 shadow-card">
                <span className="truncate text-sm">{r.name}</span>
                {r.claimed ? (
                  <Button size="sm" variant="clay" className="h-7 gap-1" disabled={send.isPending} onClick={() => send.mutate({ opponent: r.id })}>
                    <Send className="h-3.5 w-3.5" /> Retar
                  </Button>
                ) : (
                  <span className="text-[11px] text-muted-foreground">por coordinar</span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function StatusPill({ c }: { c: RRChallenge }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: c.i_am_challenger ? "Enviado" : "Te retaron", cls: "bg-action/15 text-action" },
    accepted: { label: "Aceptado", cls: "bg-info/15 text-info" },
    recorded: { label: "Por confirmar", cls: "bg-fichas/15 text-fichas" },
  };
  const s = map[c.status] ?? { label: c.status, cls: "bg-muted text-muted-foreground" };
  return <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase", s.cls)}>{s.label}</span>;
}
