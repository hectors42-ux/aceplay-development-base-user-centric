import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Users, BarChart3, Swords, Trophy, ChevronDown, Check, Clock, CircleDot } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { WeightedStandings } from "@/components/tournaments/WeightedStandings";
import { H2HMatrix } from "@/components/tournaments/H2HMatrix";
import { RRProgressCard } from "@/components/tournaments/RRProgressCard";
import { useRRProgress } from "@/hooks/useRoundRobinExtras";
import { cn } from "@/lib/utils";

interface Part { roster_player_id: string; display_name: string; claimed: boolean }
interface Edge { player_a: string; name_a: string; player_b: string; name_b: string; winner: string | null; score: string | null }

const reverseScore = (s: string | null) =>
  s ? s.split(" ").map((g) => g.split("-").reverse().join("-")).join(" ") : s;

// Vista del Round Robin de roster (Fase A). Reemplaza los tabs del motor (que no
// aplican: los participantes son roster_players, no inscripciones). Tres vistas:
//   · RIVALES: a quién reto + jugados (legible, no matriz N×N) → coordina cargas.
//   · TABLA: avance + standings ponderado (+ matriz completa colapsable).
//   · INSCRITOS: el roster.
export function RosterRRView({ categoryId, slug, canManage }: { categoryId: string; slug?: string; canManage?: boolean }) {
  const { user } = useAuth();
  const [showMatrix, setShowMatrix] = useState(false);
  const { data: progress } = useRRProgress(categoryId);

  const { data, isLoading } = useQuery({
    queryKey: ["roster-rr-view", categoryId, user?.id],
    enabled: !!categoryId,
    queryFn: async () => {
      const [{ data: parts }, { data: edges }, { data: mine }] = await Promise.all([
        supabase.rpc("round_robin_participants", { _category_id: categoryId }),
        supabase.rpc("round_robin_h2h", { _category_id: categoryId }),
        supabase.from("roster_players").select("id").eq("claimed_by", user?.id ?? "00000000-0000-0000-0000-000000000000"),
      ]);
      return {
        parts: (parts as Part[] | null) ?? [],
        edges: (edges as Edge[] | null) ?? [],
        myIds: new Set(((mine as { id: string }[] | null) ?? []).map((r) => r.id)),
      };
    },
  });

  if (isLoading) return <Skeleton className="mt-4 h-64 w-full rounded-2xl" />;
  const parts = data?.parts ?? [];
  const edges = data?.edges ?? [];
  const myIds = data?.myIds ?? new Set<string>();
  const me = parts.find((p) => myIds.has(p.roster_player_id));

  // partidos por participante + mi enfrentamiento contra cada rival.
  const playedCount = new Map<string, number>();
  for (const e of edges) {
    playedCount.set(e.player_a, (playedCount.get(e.player_a) ?? 0) + 1);
    playedCount.set(e.player_b, (playedCount.get(e.player_b) ?? 0) + 1);
  }
  const myEdge = (rivalId: string): { score: string | null; won: boolean } | null => {
    const e = edges.find((x) =>
      (x.player_a === me?.roster_player_id && x.player_b === rivalId) ||
      (x.player_b === me?.roster_player_id && x.player_a === rivalId));
    if (!e) return null;
    const iAmA = e.player_a === me?.roster_player_id;
    return { score: iAmA ? e.score : reverseScore(e.score), won: e.winner === me?.roster_player_id };
  };
  const rivals = me ? parts.filter((p) => p.roster_player_id !== me.roster_player_id) : [];
  const pending = rivals.filter((r) => !myEdge(r.roster_player_id));
  const played = rivals.filter((r) => myEdge(r.roster_player_id));

  const CargaCTA = canManage && slug ? (
    <Link to={`/torneos/${slug}/gestionar`} className="inline-flex items-center gap-1 rounded-lg border border-action/40 bg-action/10 px-2.5 py-1 text-xs font-semibold text-action transition-smooth hover:bg-action/20">
      <Swords className="h-3 w-3" /> Cargar
    </Link>
  ) : null;

  return (
    <Tabs defaultValue="rivals" className="mt-3">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="rivals" className="text-[11px]"><Swords className="mr-1 h-3 w-3" /> Rivales</TabsTrigger>
        <TabsTrigger value="table" className="text-[11px]"><BarChart3 className="mr-1 h-3 w-3" /> Tabla</TabsTrigger>
        <TabsTrigger value="players" className="text-[11px]"><Users className="mr-1 h-3 w-3" /> Inscritos</TabsTrigger>
      </TabsList>

      {/* ── RIVALES: coordinación legible (no matriz) ── */}
      <TabsContent value="rivals" className="mt-4 space-y-4">
        {!me ? (
          <p className="rounded-2xl border border-dashed border-border bg-muted/20 p-4 text-center text-xs text-muted-foreground">
            No estás inscrito en esta categoría. Mira la tabla y los inscritos.
          </p>
        ) : (
          <>
            {canManage && slug && (
              <Link to={`/torneos/${slug}/gestionar`} className="flex items-center justify-between rounded-2xl border border-action/40 bg-action/[0.06] px-4 py-3 text-sm font-semibold text-action transition-smooth hover:bg-action/10">
                <span className="flex items-center gap-2"><Swords className="h-4 w-4" /> Coordinar y cargar resultados</span>
                <span className="text-xs">Panel del organizador →</span>
              </Link>
            )}
            {/* Por jugar */}
            <section>
              <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-action">
                <Clock className="h-3.5 w-3.5" /> Por jugar · {pending.length}
              </p>
              {pending.length === 0 ? (
                <p className="text-xs text-muted-foreground">Ya jugaste con todos tus rivales.</p>
              ) : (
                <div className="space-y-1.5">
                  {pending.map((r) => (
                    <div key={r.roster_player_id} className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2 shadow-card">
                      <span className="flex items-center gap-2 truncate text-sm">
                        <CircleDot className="h-3.5 w-3.5 shrink-0 text-action" /> {r.display_name}
                      </span>
                      {CargaCTA ?? <span className="text-[11px] text-muted-foreground">por coordinar</span>}
                    </div>
                  ))}
                </div>
              )}
            </section>
            {/* Jugados */}
            {played.length > 0 && (
              <section>
                <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <Trophy className="h-3.5 w-3.5" /> Jugados · {played.length}
                </p>
                <div className="space-y-1.5">
                  {played.map((r) => {
                    const e = myEdge(r.roster_player_id)!;
                    return (
                      <div key={r.roster_player_id} className={cn("flex items-center justify-between gap-2 rounded-xl border px-3 py-2", e.won ? "border-confirm/30 bg-confirm/[0.05]" : "border-border bg-card")}>
                        <span className="flex items-center gap-2 truncate text-sm">
                          <Check className={cn("h-3.5 w-3.5 shrink-0", e.won ? "text-confirm" : "text-muted-foreground/50")} /> {r.display_name}
                        </span>
                        <span className="flex items-center gap-2 shrink-0">
                          <span className="font-mono text-xs tabular-nums text-muted-foreground">{e.score ?? "—"}</span>
                          <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-bold uppercase", e.won ? "bg-confirm/15 text-confirm" : "bg-muted text-muted-foreground")}>{e.won ? "Ganaste" : "Perdiste"}</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </>
        )}
      </TabsContent>

      {/* ── TABLA: avance + standings + matriz colapsable ── */}
      <TabsContent value="table" className="mt-4 space-y-4">
        <RRProgressCard categoryId={categoryId} />
        <WeightedStandings categoryId={categoryId} prizeTop={progress?.prize_top ?? 0} asadoBottom={progress?.asado_bottom ?? 0} />
        <div>
          <button type="button" onClick={() => setShowMatrix((v) => !v)}
            className="flex w-full items-center justify-between rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground transition-smooth hover:bg-muted/40">
            <span>Matriz completa de enfrentamientos</span>
            <ChevronDown className={cn("h-4 w-4 transition-transform", showMatrix && "rotate-180")} />
          </button>
          {showMatrix && <div className="mt-2"><H2HMatrix categoryId={categoryId} /></div>}
        </div>
      </TabsContent>

      {/* ── INSCRITOS ── */}
      <TabsContent value="players" className="mt-4">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Inscritos · {parts.length}</p>
        <div className="space-y-1">
          {parts.map((p, i) => (
            <div key={p.roster_player_id} className={cn("flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-sm", myIds.has(p.roster_player_id) && "border-skill/40 bg-skill/[0.06]")}>
              <span className="flex items-center gap-2 truncate">
                <span className="w-5 text-right text-[11px] tabular-nums text-muted-foreground">{i + 1}</span>
                <span className={cn("truncate", myIds.has(p.roster_player_id) && "font-semibold text-skill")}>{p.display_name}</span>
                {myIds.has(p.roster_player_id) && <span className="text-[9px] font-bold uppercase text-skill">· tú</span>}
              </span>
              <span className="shrink-0 text-[11px] text-muted-foreground">{playedCount.get(p.roster_player_id) ?? 0} jug.</span>
            </div>
          ))}
        </div>
      </TabsContent>
    </Tabs>
  );
}
