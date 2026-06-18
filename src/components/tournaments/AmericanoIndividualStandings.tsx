import { useMemo } from "react";
import { Loader2 } from "lucide-react";
import { useAmericanoIndividualStandings } from "@/hooks/useAmericanoIndividualStandings";
import { playerName, type Player } from "@/hooks/useCategoryData";
import { StandingsHero } from "./standings/StandingsHero";
import { StandingsFAB } from "./standings/StandingsFAB";
import { MedalBadge } from "./standings/MedalBadge";
import { useFlipReorder } from "./standings/useFlipReorder";

interface Props {
  categoryId: string;
  players: Map<string, Player>;
  highlightUserId?: string;
  onLoadResult?: () => void;
}

export const AmericanoIndividualStandings = ({
  categoryId,
  players,
  highlightUserId,
  onLoadResult,
}: Props) => {
  const { rows, loading } = useAmericanoIndividualStandings(categoryId);

  const orderedIds = useMemo(() => rows.map((r) => r.user_id), [rows]);
  const { setRef } = useFlipReorder(orderedIds, { userId: highlightUserId ?? null });

  const myIdx = highlightUserId ? rows.findIndex((r) => r.user_id === highlightUserId) : -1;
  const myRow = myIdx >= 0 ? rows[myIdx] : null;
  const myPosition = myIdx >= 0 ? myIdx + 1 : 0;
  const isMyTail = rows.length > 0 && myPosition > rows.length * 0.75;
  const myPP = myRow ? Math.max(0, myRow.matches_played - myRow.matches_won) : 0;

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-6 text-center text-xs text-muted-foreground">
        Aún no hay partidos jugados. La tabla se llena al cargar resultados.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {myRow && (
        <StandingsHero
          position={myPosition}
          total={rows.length}
          pj={myRow.matches_played}
          pg={myRow.matches_won}
          pp={myPP}
          points={myRow.games_won}
          pointsDecimals={0}
          tailWinsNeeded={
            isMyTail ? Math.max(1, Math.ceil(rows.length * 0.25) - (rows.length - myPosition)) : 0
          }
        />
      )}
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <table className="tnum w-full text-sm">
        <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left">#</th>
            <th className="px-3 py-2 text-left">Jugador</th>
            <th className="px-3 py-2 text-right">PJ</th>
            <th className="px-3 py-2 text-right">PG</th>
            <th className="px-3 py-2 text-right">JG</th>
            <th className="px-3 py-2 text-right">Dif</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => {
            const isMe = highlightUserId && r.user_id === highlightUserId;
            const rank = idx + 1;
            const name = playerName(players.get(r.user_id), "Jugador");
            return (
              <tr
                key={r.user_id}
                ref={setRef(r.user_id) as (el: HTMLTableRowElement | null) => void}
                className={`border-t border-border ${
                  isMe ? "border-l-[3px] border-l-primary bg-primary/[0.06] font-medium" : ""
                }`}
              >
                <td className="px-3 py-2 text-left text-xs text-muted-foreground">
                  {rank <= 3 ? <MedalBadge rank={rank as 1 | 2 | 3} /> : r.position}
                </td>
                <td className="px-3 py-2 text-left">
                  {isMe ? <span className="font-semibold">Tú · {name}</span> : name}
                </td>
                <td className="px-3 py-2 text-right">{r.matches_played}</td>
                <td className="px-3 py-2 text-right">{r.matches_won}</td>
                <td className="px-3 py-2 text-right font-semibold">{r.games_won}</td>
                <td className="px-3 py-2 text-right">{r.games_diff > 0 ? `+${r.games_diff}` : r.games_diff}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
      {onLoadResult && (
        <StandingsFAB
          label={isMyTail ? "Desafiar para salir de la cola" : "Cargar resultado"}
          onClick={onLoadResult}
        />
      )}
    </div>
  );
};