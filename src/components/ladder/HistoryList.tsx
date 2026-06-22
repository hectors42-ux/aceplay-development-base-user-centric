import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowDown, ArrowUp, Filter, Minus, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { HistoryRow, ProfileLite } from "@/hooks/useLadderData";

const REASON_LABEL: Record<string, string> = {
  ingreso: "Ingreso",
  retiro: "Retiro",
  desafio_ganado: "Ganó desafío",
  desafio_perdido: "Perdió desafío",
  walkover: "Walkover",
  inactividad: "Inactividad",
  ajuste_admin: "Ajuste admin",
};

type ReasonFilter = "todos" | "desafios" | "ingresos" | "ajustes";

const REASON_FILTERS: { v: ReasonFilter; l: string; reasons: string[] }[] = [
  { v: "todos", l: "Todos", reasons: [] },
  { v: "desafios", l: "Desafíos", reasons: ["desafio_ganado", "desafio_perdido", "walkover"] },
  { v: "ingresos", l: "Ingresos/retiros", reasons: ["ingreso", "retiro"] },
  { v: "ajustes", l: "Ajustes", reasons: ["ajuste_admin", "inactividad"] },
];

interface Props {
  history: HistoryRow[];
  profilesById: Record<string, ProfileLite>;
}

const fullName = (p?: ProfileLite) =>
  p ? `${p.first_name} ${p.last_name}`.trim() : "Jugador";

export const HistoryList = ({ history, profilesById }: Props) => {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ReasonFilter>("todos");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const reasonSet = new Set(
      REASON_FILTERS.find((f) => f.v === filter)?.reasons ?? [],
    );
    return history.filter((h) => {
      if (filter !== "todos" && !reasonSet.has(h.reason)) return false;
      if (q) {
        const name = fullName(profilesById[h.user_id]).toLowerCase();
        if (!name.includes(q)) return false;
      }
      return true;
    });
  }, [history, profilesById, search, filter]);

  if (history.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
        Aún no hay movimientos en esta Escalerilla.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar jugador"
          className="h-9 rounded-2xl pl-9 text-xs"
          aria-label="Buscar jugador en historial"
        />
      </div>
      <div className="flex items-center gap-1.5 overflow-x-auto">
        <Filter className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        {REASON_FILTERS.map((opt) => (
          <button
            key={opt.v}
            type="button"
            onClick={() => setFilter(opt.v)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1 text-[11px] font-medium transition-smooth",
              filter === opt.v
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {opt.l}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
          Sin coincidencias para los filtros aplicados.
        </p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((h) => {
            const before = h.position_before;
            const after = h.position_after;
            const delta = before != null && after != null ? before - after : 0;
            const Icon = delta > 0 ? ArrowUp : delta < 0 ? ArrowDown : Minus;
            const color =
              delta > 0
                ? "text-success"
                : delta < 0
                  ? "text-destructive"
                  : "text-muted-foreground";
            return (
              <li
                key={h.id}
                className="flex items-start gap-3 rounded-2xl border border-border bg-card p-3 shadow-card"
              >
                <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted ${color}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {fullName(profilesById[h.user_id])}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {REASON_LABEL[h.reason] ?? h.reason}
                    {before != null && after != null && (
                      <>
                        {" · "}
                        #{before} → #{after}
                      </>
                    )}
                  </p>
                </div>
                <p className="shrink-0 text-[10px] text-muted-foreground">
                  {format(parseISO(h.recorded_at), "d MMM", { locale: es })}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
