import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/components/providers/AuthProvider";
import { cn } from "@/lib/utils";

// Tabla PONDERADA del reglamento (Fase A · round_robin_standings, SOLO LECTURA).
// Puntaje = PG×1.0 + Sets×0.1 + Juegos×0.01 + ST×0.001. Ordenada por la jerarquía
// de desempate de 5 niveles (la resuelve el RPC). Muestra users y roster_players
// (sin cuenta) con el mismo formato.
interface Row {
  player: string;
  display_name: string;
  source: string;
  partidos_jugados: number;
  partidos_ganados: number;
  sets_ganados: number;
  juegos_ganados: number;
  puntos_st: number;
  puntaje: number;
}

export function WeightedStandings({ categoryId, className }: { categoryId: string; className?: string }) {
  const { user } = useAuth();
  const { data, isLoading } = useQuery<Row[]>({
    queryKey: ["rr-weighted-standings", categoryId],
    enabled: !!categoryId,
    queryFn: async () => {
      const { data } = await supabase.rpc("round_robin_standings", { _category_id: categoryId });
      return (data as Row[] | null) ?? [];
    },
  });
  // roster_player(s) del usuario actual → para resaltar SU fila (volt) si participa.
  const { data: myRosterIds } = useQuery<Set<string>>({
    queryKey: ["my-roster-ids", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("roster_players").select("id").eq("claimed_by", user!.id);
      return new Set(((data as { id: string }[] | null) ?? []).map((r) => r.id));
    },
  });

  if (isLoading) return <Skeleton className={cn("h-40 w-full rounded-2xl", className)} />;
  if (!data || data.length === 0) {
    return (
      <p className={cn("rounded-2xl border border-dashed border-border bg-card/50 p-6 text-center text-sm text-muted-foreground", className)}>
        Aún no hay resultados cargados.
      </p>
    );
  }

  return (
    <div className={cn("overflow-hidden rounded-2xl border border-border bg-card shadow-card", className)}>
      <div className="grid grid-cols-[24px_1fr_28px_28px_28px_32px_32px_52px] items-center gap-1 border-b border-border px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <span>#</span><span>Jugador</span>
        <span className="text-center" title="Partidos jugados">PJ</span>
        <span className="text-center" title="Partidos ganados">PG</span>
        <span className="text-center" title="Sets ganados">S</span>
        <span className="text-center" title="Juegos ganados">J</span>
        <span className="text-center" title="Puntos super tie-break">ST</span>
        <span className="text-center" title="Puntaje ponderado">Pts</span>
      </div>
      {data.map((r, i) => {
        const isMe = !!myRosterIds?.has(r.player);
        return (
        <div
          key={r.player}
          className={cn(
            "grid grid-cols-[24px_1fr_28px_28px_28px_32px_32px_52px] items-center gap-1 px-3 py-1.5 text-sm",
            isMe ? "bg-skill/15 ring-1 ring-inset ring-skill/40" : i === 0 && "bg-skill/5",
          )}
        >
          <span className={cn("tabular-nums", isMe ? "font-bold text-skill" : "text-muted-foreground")}>{i + 1}</span>
          <span className="flex items-center gap-1 truncate">
            <span className={cn("truncate", isMe && "font-semibold text-skill")}>{r.display_name}</span>
            {isMe && <span className="shrink-0 text-[9px] font-bold uppercase text-skill">· tú</span>}
            {r.source !== "self" && r.source !== "claimed" && (
              <span className="shrink-0 rounded-full border border-border px-1 text-[8px] uppercase text-muted-foreground">inv</span>
            )}
          </span>
          <span className="text-center tabular-nums text-muted-foreground">{r.partidos_jugados}</span>
          <span className="text-center font-display font-bold tabular-nums">{r.partidos_ganados}</span>
          <span className="text-center tabular-nums text-muted-foreground">{r.sets_ganados}</span>
          <span className="text-center tabular-nums text-muted-foreground">{r.juegos_ganados}</span>
          <span className="text-center tabular-nums text-muted-foreground">{r.puntos_st}</span>
          <span className="text-center font-display font-bold tabular-nums text-skill">{r.puntaje}</span>
        </div>
        );
      })}
    </div>
  );
}
