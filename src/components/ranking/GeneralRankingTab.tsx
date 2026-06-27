import { useState } from "react";
import { Link } from "react-router-dom";
import { Trophy, ChevronRight } from "lucide-react";
import { UserAvatar } from "@/components/avatar/UserAvatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useGeneralRanking, type RankingFormat, type GeneralRankingRow } from "@/hooks/useGeneralRanking";
import { formatLevel } from "@/lib/rating-utils";
import { cn } from "@/lib/utils";

const TOP_N = 20;

function Row({ row }: { row: GeneralRankingRow }) {
  const me = row.is_me;
  return (
    <Link
      to={`/jugador/${row.user_id}`}
      className={cn(
        "flex h-[64px] items-center gap-2.5 rounded-2xl border px-2.5 transition-smooth",
        me ? "border-skill bg-skill/[0.07] shadow-clay" : "border-border bg-card shadow-card hover:bg-muted/40",
      )}
    >
      <span className={cn("w-8 shrink-0 text-center font-display text-sm font-bold", me ? "text-skill" : "text-foreground")}>
        #{row.rank_position}
      </span>
      <UserAvatar kind={row.avatar_kind} look={row.avatar_look} url={row.avatar_url} name={row.name ?? "Jugador"} className="h-9 w-9 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{row.name ?? "Jugador"}</p>
          {me && <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider text-skill">Tú</span>}
        </div>
        <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
          {row.category ? `${row.category} · ` : ""}{row.matches_played} {row.matches_played === 1 ? "partido" : "partidos"}
        </p>
      </div>
      <div className="flex w-12 shrink-0 flex-col items-end">
        <span className={cn("font-display text-base font-bold leading-none", me ? "text-skill" : "text-foreground")}>{formatLevel(row.level)}</span>
        <span className="mt-0.5 text-[9px] uppercase tracking-wide text-muted-foreground">nivel</span>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}

// Tab RANKING general (Tanda 4). Separación deporte + modalidad; mi posición en
// volt; top N + mi ventana si quedo más abajo; tap → perfil público (con guarda).
// SOLO LECTURA: muestra Nivel 0–7, nunca el Glicko crudo de otros.
export function GeneralRankingTab({ dbSport }: { dbSport: "tennis" | "padel" }) {
  const padelOnly = dbSport === "padel";
  const [format, setFormat] = useState<RankingFormat>(padelOnly ? "doubles" : "singles");
  const fmt: RankingFormat = padelOnly ? "doubles" : format;
  const { data: rows = [], isLoading } = useGeneralRanking(dbSport, fmt);

  const me = rows.find((r) => r.is_me) ?? null;
  const top = rows.slice(0, TOP_N);
  const meBelow = me && me.rank_position > TOP_N ? me : null;

  return (
    <section className="space-y-3">
      {/* Selector de modalidad (pádel solo dobles — hay CHECK en la tabla). */}
      <div className="grid grid-cols-2 gap-1 rounded-2xl border border-border bg-muted/30 p-1">
        {(["singles", "doubles"] as const).map((f) => {
          const disabled = padelOnly && f === "singles";
          const active = fmt === f;
          return (
            <button
              key={f}
              type="button"
              disabled={disabled}
              onClick={() => setFormat(f)}
              className={cn(
                "rounded-xl px-3 py-2 text-sm font-semibold transition-smooth",
                active ? "bg-card text-foreground shadow-card" : "text-muted-foreground hover:text-foreground",
                disabled && "cursor-not-allowed opacity-40 hover:text-muted-foreground",
              )}
            >
              {f === "singles" ? "Singles" : "Dobles"}
            </button>
          );
        })}
      </div>

      {/* Mi posición de un vistazo. */}
      {me && (
        <div className="flex items-center justify-between rounded-2xl border border-skill/30 bg-skill/[0.05] px-4 py-2.5">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <Trophy className="h-3.5 w-3.5 text-skill" /> Tu posición
          </span>
          <span className="font-display text-sm font-bold text-skill">#{me.rank_position} de {rows.length}</span>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-1.5">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[64px] w-full rounded-2xl" />)}
        </div>
      ) : rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center text-sm text-muted-foreground">
          Aún no hay jugadores rankeados en esta modalidad.
        </p>
      ) : (
        <div className="space-y-1.5">
          {top.map((r) => <Row key={r.user_id} row={r} />)}
          {meBelow && (
            <>
              <p className="py-1 text-center text-[10px] uppercase tracking-wider text-muted-foreground">· · ·</p>
              <Row row={meBelow} />
            </>
          )}
        </div>
      )}
    </section>
  );
}
