import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// Matriz N×N de enfrentamientos (Fase A · round_robin_h2h, SOLO LECTURA).
// Fila = jugador i; columna = jugador j. Celda = marcador de i vs j (desde la
// perspectiva de la fila). Diagonal inerte; vacío "·" si no jugaron.
interface Edge { player_a: string; name_a: string; player_b: string; name_b: string; winner: string | null; score: string | null }
interface Part { roster_player_id: string; display_name: string }

const reverseScore = (s: string | null) =>
  s ? s.split(" ").map((g) => g.split("-").reverse().join("-")).join(" ") : s;

const initials = (name: string) => name.split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

export function H2HMatrix({ categoryId, className }: { categoryId: string; className?: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["rr-h2h", categoryId],
    enabled: !!categoryId,
    queryFn: async () => {
      const [{ data: parts }, { data: edges }] = await Promise.all([
        supabase.rpc("round_robin_participants", { _category_id: categoryId }),
        supabase.rpc("round_robin_h2h", { _category_id: categoryId }),
      ]);
      return { parts: (parts as Part[] | null) ?? [], edges: (edges as Edge[] | null) ?? [] };
    },
  });

  if (isLoading) return <Skeleton className={cn("h-48 w-full rounded-2xl", className)} />;
  const parts = data?.parts ?? [];
  if (parts.length === 0) return null;

  // result[rowId][colId] = { score (desde la fila), rowWon }
  const result = new Map<string, Map<string, { score: string | null; rowWon: boolean }>>();
  const put = (row: string, col: string, score: string | null, winner: string | null) => {
    if (!result.has(row)) result.set(row, new Map());
    result.get(row)!.set(col, { score, rowWon: winner === row });
  };
  for (const e of data?.edges ?? []) {
    put(e.player_a, e.player_b, e.score, e.winner);
    put(e.player_b, e.player_a, reverseScore(e.score), e.winner);
  }

  return (
    <div className={cn("overflow-x-auto rounded-2xl border border-border bg-card shadow-card", className)}>
      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-card p-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">vs</th>
            {parts.map((p) => (
              <th key={p.roster_player_id} className="p-1.5 text-center font-mono text-[10px] font-semibold text-muted-foreground" title={p.display_name}>
                {initials(p.display_name)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {parts.map((row) => (
            <tr key={row.roster_player_id} className="border-t border-border/60">
              <td className="sticky left-0 z-10 max-w-[120px] truncate bg-card p-2 text-left font-medium">{row.display_name}</td>
              {parts.map((col) => {
                if (row.roster_player_id === col.roster_player_id) {
                  return <td key={col.roster_player_id} className="bg-muted/30 p-1.5 text-center text-muted-foreground/40">—</td>;
                }
                const cell = result.get(row.roster_player_id)?.get(col.roster_player_id);
                return (
                  <td key={col.roster_player_id} className="p-1.5 text-center tabular-nums">
                    {cell?.score ? (
                      <span className={cn(cell.rowWon ? "font-semibold text-confirm" : "text-muted-foreground")}>{cell.score}</span>
                    ) : (
                      <span className="text-muted-foreground/30">·</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
