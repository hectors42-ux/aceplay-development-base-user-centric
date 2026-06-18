import { memo, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  AlertCircle,
  ArrowRight,
  Check,
  Clock,
  Filter,
  History,
  Hourglass,
  Loader2,
  Swords,
  Trophy,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  useMatchHistory,
  type PlayedMatchRow,
  type PendingTournamentMatch,
  type PendingLadderMatch,
} from "@/hooks/useMatchHistory";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  mode: "own" | "public";
  ownerName?: string;
  /** Filtro inicial cuando se abre el sheet. Por defecto "all". */
  initialFilter?: Filter;
}

type Filter = "all" | "pending" | "tournament" | "ladder" | "friendly";

const FILTER_LABEL: Record<Filter, string> = {
  all: "Todos",
  pending: "Pendientes",
  tournament: "Torneos",
  ladder: "Pirámide",
  friendly: "Amistosos",
};

const formatScore = (raw: unknown): string | null => {
  if (!raw) return null;
  if (Array.isArray(raw)) {
    const sets = raw
      .map((s: { a?: number; b?: number }) =>
        typeof s?.a === "number" && typeof s?.b === "number" ? `${s.a}-${s.b}` : null,
      )
      .filter(Boolean);
    return sets.length ? sets.join(", ") : null;
  }
  return null;
};

const sourceToCategory = (source: string): "tournament" | "ladder" | "friendly" | "other" => {
  if (source === "tournament_match" || source === "partido_torneo") return "tournament";
  if (source === "ladder_challenge" || source === "desafio_ladder") return "ladder";
  if (source === "open_match" || source === "amistoso") return "friendly";
  return "other";
};

const sourceBadge = (source: string) => {
  const cat = sourceToCategory(source);
  if (cat === "tournament")
    return { label: "Torneo", icon: Trophy, classes: "bg-primary/15 text-primary" };
  if (cat === "ladder")
    return { label: "Pirámide", icon: Swords, classes: "bg-accent/20 text-accent-foreground" };
  if (cat === "friendly")
    return { label: "Amistoso", icon: History, classes: "bg-muted text-muted-foreground" };
  return { label: "Otro", icon: History, classes: "bg-muted text-muted-foreground" };
};

/** Estado visible del partido para el usuario actual */
type MatchStatus =
  | { kind: "done" }
  | { kind: "needs_result" }
  | { kind: "needs_confirm" }
  | { kind: "waiting_opponent" };

const STATUS_STYLE: Record<
  MatchStatus["kind"],
  { label: string; classes: string; icon: typeof Check }
> = {
  done: { label: "Listo", classes: "bg-success/15 text-success", icon: Check },
  needs_result: {
    label: "Falta resultado",
    classes: "bg-warning/15 text-warning",
    icon: AlertCircle,
  },
  needs_confirm: {
    label: "Por confirmar",
    classes: "bg-warning/15 text-warning",
    icon: AlertCircle,
  },
  waiting_opponent: {
    label: "Esperando rival",
    classes: "bg-muted text-muted-foreground",
    icon: Hourglass,
  },
};

/** Item unificado para renderizar en la lista (jugado o pendiente) */
type Row =
  | { kind: "played"; data: PlayedMatchRow; sortKey: string }
  | {
      kind: "pending_t";
      data: PendingTournamentMatch;
      sortKey: string;
    }
  | {
      kind: "pending_l";
      data: PendingLadderMatch;
      sortKey: string;
    };

export const MatchHistorySheet = ({ open, onOpenChange, userId, mode, ownerName, initialFilter = "all" }: Props) => {
  const [filter, setFilter] = useState<Filter>(initialFilter);

  // Sincroniza el filtro cuando el caller cambia `initialFilter` (e.g. abrir desde "Gestionar pendientes").
  useEffect(() => {
    if (open) setFilter(initialFilter);
  }, [open, initialFilter]);

  const { data, isLoading } = useMatchHistory(userId, {
    enabled: open,
    limit: mode === "own" ? 50 : 10,
  });

  // Mezcla jugados + pendientes y calcula conteo en una sola pasada.
  // Solo se recalcula cuando cambia `data` o `mode`, NO cuando cambia el filtro.
  const { allRows, pendingCount } = useMemo(() => {
    const rows: Row[] = [];
    const played = data?.played ?? [];
    for (let i = 0; i < played.length; i++) {
      const m = played[i];
      rows.push({ kind: "played", data: m, sortKey: m.recorded_at });
    }
    let pending = 0;
    if (mode === "own") {
      const pt = data?.pending_tournaments ?? [];
      for (let i = 0; i < pt.length; i++) {
        const t = pt[i];
        rows.push({
          kind: "pending_t",
          data: t,
          sortKey: t.scheduled_at ?? t.created_at,
        });
      }
      const pl = data?.pending_ladder ?? [];
      for (let i = 0; i < pl.length; i++) {
        const l = pl[i];
        rows.push({
          kind: "pending_l",
          data: l,
          sortKey: l.scheduled_at ?? l.created_at,
        });
      }
      pending = pt.length + pl.length;
    }
    rows.sort((a, b) => (a.sortKey < b.sortKey ? 1 : a.sortKey > b.sortKey ? -1 : 0));
    return { allRows: rows, pendingCount: pending };
  }, [data, mode]);

  // Filtro barato: solo recorre la lista ya armada.
  const filtered = useMemo(() => {
    if (filter === "all") return allRows;
    if (filter === "pending") {
      return allRows.filter((r) => r.kind === "pending_t" || r.kind === "pending_l");
    }
    return allRows.filter((r) => {
      if (r.kind === "played") return sourceToCategory(r.data.source) === filter;
      if (r.kind === "pending_t") return filter === "tournament";
      return filter === "ladder";
    });
  }, [allRows, filter]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] overflow-hidden p-0">
        <div className="mx-auto flex h-full max-w-md flex-col">
          <SheetHeader className="border-b border-border p-4 pr-10 text-left">
            <SheetTitle className="font-display text-base">
              {mode === "own"
                ? "Historial de partidos"
                : `Últimos partidos${ownerName ? ` · ${ownerName}` : ""}`}
            </SheetTitle>
            <p className="text-[11px] text-muted-foreground">
              {mode === "own" ? "Hasta los 50 más recientes" : "Hasta los 10 más recientes"}
              {mode === "own" && pendingCount > 0 && (
                <>
                  {" · "}
                  <span className="font-semibold text-warning">
                    {pendingCount} sin resultado
                  </span>
                </>
              )}
            </p>
          </SheetHeader>

          {/* Filtros */}
          <div className="flex items-center gap-1.5 overflow-x-auto px-4 py-2 border-b border-border scrollbar-none">
            <Filter className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            {(Object.keys(FILTER_LABEL) as Filter[])
              // En perfil público no mostramos "Pendientes" porque no hay pendientes públicos
              .filter((f) => !(f === "pending" && mode !== "own"))
              .map((f) => {
                const showCount = f === "pending" && pendingCount > 0;
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFilter(f)}
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-medium transition-smooth",
                      filter === f
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {FILTER_LABEL[f]}
                    {showCount && (
                      <span
                        className={cn(
                          "ml-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-bold tabular-nums",
                          filter === f
                            ? "bg-primary-foreground text-primary"
                            : "bg-warning/20 text-warning",
                        )}
                        aria-label={`${pendingCount} pendientes`}
                      >
                        {pendingCount}
                      </span>
                    )}
                  </button>
                );
              })}
          </div>

          {/* Lista */}
          <div className="flex-1 overflow-y-auto px-4 py-3">
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-2xl" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border bg-card/50 p-6 text-center text-xs text-muted-foreground">
                {filter === "all"
                  ? "Sin partidos aún."
                  : `Sin partidos en ${FILTER_LABEL[filter].toLowerCase()}.`}
              </p>
            ) : (
              <ul className="space-y-2">
                {filtered.map((row) => {
                  if (row.kind === "played") {
                    return <PlayedRow key={`p-${row.data.id}`} match={row.data} />;
                  }
                  if (row.kind === "pending_t") {
                    return (
                      <PendingTournamentRow
                        key={`pt-${row.data.match_id}`}
                        match={row.data}
                        onClose={() => onOpenChange(false)}
                      />
                    );
                  }
                  return (
                    <PendingLadderRow
                      key={`pl-${row.data.challenge_id}`}
                      match={row.data}
                      userId={userId}
                      onClose={() => onOpenChange(false)}
                    />
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

/** Badge de estado reusado en todas las filas */
const StatusBadge = memo(({ status }: { status: MatchStatus["kind"] }) => {
  const cfg = STATUS_STYLE[status];
  const Icon = cfg.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider",
        cfg.classes,
      )}
    >
      <Icon className="h-2.5 w-2.5" />
      {cfg.label}
    </span>
  );
});
StatusBadge.displayName = "StatusBadge";

/** Aviso de partido pendiente cuya fecha programada ya pasó */
const OverdueBadge = memo(() => (
  <span
    className="inline-flex items-center gap-0.5 rounded-full bg-destructive/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-destructive"
    aria-label="Partido vencido"
  >
    <AlertCircle className="h-2.5 w-2.5" />
    Vencido
  </span>
));
OverdueBadge.displayName = "OverdueBadge";

const PlayedRow = memo(({ match }: { match: PlayedMatchRow }) => {
  const badge = sourceBadge(match.source);
  const Icon = badge.icon;
  const score = formatScore(match.score);
  const dateLabel = format(parseISO(match.recorded_at), "d MMM yy", { locale: es });
  const deltaSign = match.delta > 0 ? "+" : "";
  return (
    <li className="flex items-start gap-3 rounded-2xl border border-border bg-card p-3 shadow-card">
      <span
        className={cn(
          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          badge.classes,
        )}
        aria-hidden
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1">
          <span
            className={cn(
              "rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider",
              match.won ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive",
            )}
          >
            {match.won ? "Ganaste" : "Perdiste"}
          </span>
          <span className={cn("rounded-full px-1.5 py-0.5 text-[9px] font-medium", badge.classes)}>
            {badge.label}
          </span>
          <StatusBadge status="done" />
        </div>
        {score && (
          <p className="mt-1 truncate font-display text-sm font-semibold tabular-nums text-foreground">
            {score}
          </p>
        )}
        <p className="text-[10px] text-muted-foreground">{dateLabel}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-0.5">
        <span
          className={cn(
            "inline-flex items-center gap-0.5 text-[11px] font-semibold tabular-nums",
            match.delta > 0
              ? "text-success"
              : match.delta < 0
                ? "text-destructive"
                : "text-muted-foreground",
          )}
        >
          {match.delta > 0 ? (
            <TrendingUp className="h-3 w-3" />
          ) : match.delta < 0 ? (
            <TrendingDown className="h-3 w-3" />
          ) : null}
          {deltaSign}
          {match.delta.toFixed(2)}
        </span>
        <span className="text-[10px] text-muted-foreground tabular-nums">
          {match.level_after.toFixed(2)}
        </span>
      </div>
    </li>
  );
});
PlayedRow.displayName = "PlayedRow";

const PendingTournamentRow = memo(({
  match,
  onClose,
}: {
  match: PendingTournamentMatch;
  /** Cierra el sheet — solo se invoca cuando llevamos al usuario a otra pantalla a actuar. */
  onClose: () => void;
}) => {
  // Mismo mapeo que Pirámide para consistencia visual
  const status: MatchStatus["kind"] =
    match.needs_action === "confirm"
      ? "needs_confirm"
      : match.needs_action === "wait"
        ? "waiting_opponent"
        : "needs_result";
  const isWait = match.needs_action === "wait";
  const isConfirm = match.needs_action === "confirm";
  const dateLabel = match.scheduled_at
    ? format(parseISO(match.scheduled_at), "d MMM · HH:mm", { locale: es })
    : "Sin fecha";
  const isOverdue = match.scheduled_at ? parseISO(match.scheduled_at) < new Date() : false;
  const badge = sourceBadge("partido_torneo");

  // CTAs:
  //  - "Cargar" / "Revisar" → llevan al detalle de la categoría con dialog abierto → cerramos sheet
  //  - "Ver" (wait)         → solo consulta, mantenemos el sheet abierto para seguir revisando
  const ctaLabel = isWait ? "Ver" : isConfirm ? "Revisar" : "Cargar";
  const ctaVariant = isWait ? "ghost" : isConfirm ? "outline" : "default";
  const target = `/torneos/${match.tournament_slug}/cat/${match.category_id}?openResult=${match.match_id}`;

  return (
    <li
      className={cn(
        "flex items-start gap-3 rounded-2xl border p-3",
        isWait ? "border-border bg-card" : "border-warning/40 bg-warning/5",
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          badge.classes,
        )}
        aria-hidden
      >
        <Trophy className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1">
          <span className={cn("rounded-full px-1.5 py-0.5 text-[9px] font-medium", badge.classes)}>
            Torneo
          </span>
          <StatusBadge status={status} />
          {isOverdue && !isWait && <OverdueBadge />}
        </div>
        <p className="mt-1 truncate text-xs font-semibold leading-tight">vs {match.opponent_name}</p>
        <p className="truncate text-[10px] text-muted-foreground">
          {match.tournament_name} · {match.category_name}
        </p>
        <p
          className={cn(
            "flex items-center gap-1 text-[10px]",
            isOverdue && !isWait ? "font-semibold text-warning" : "text-muted-foreground",
          )}
        >
          <Clock className="h-2.5 w-2.5" />
          {dateLabel}
        </p>
      </div>
      <Button
        asChild
        size="sm"
        variant={ctaVariant}
        className="h-7 shrink-0 px-2.5 text-[10px]"
        onClick={() => {
          // Solo cerramos el sheet cuando vamos a actuar (cargar/revisar).
          if (!isWait) onClose();
        }}
      >
        <Link to={target} aria-label={`${ctaLabel} resultado vs ${match.opponent_name}`}>
          {ctaLabel}
          <ArrowRight className="ml-0.5 h-3 w-3" />
        </Link>
      </Button>
    </li>
  );
});
PendingTournamentRow.displayName = "PendingTournamentRow";

const PendingLadderRow = memo(({
  match,
  userId,
  onClose,
}: {
  match: PendingLadderMatch;
  userId: string;
  /** Solo se invoca cuando navegamos fuera (cargar resultado en /ranking). */
  onClose: () => void;
}) => {
  const qc = useQueryClient();
  const [confirmState, setConfirmState] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const status: MatchStatus["kind"] =
    match.needs_action === "confirm"
      ? "needs_confirm"
      : match.needs_action === "wait"
        ? "waiting_opponent"
        : "needs_result";
  const dateLabel = match.scheduled_at
    ? format(parseISO(match.scheduled_at), "d MMM · HH:mm", { locale: es })
    : "Sin fecha";
  const isOverdue = match.scheduled_at ? parseISO(match.scheduled_at) < new Date() : false;
  const badge = sourceBadge("desafio_ladder");

  const isConfirm = match.needs_action === "confirm";
  const isWait = match.needs_action === "wait";
  const isSubmit = match.needs_action === "submit";

  const confirmLadder = async () => {
    setConfirmState("loading");
    setErrorMsg(null);
    const { error } = await supabase.rpc("confirm_ladder_result", {
      _challenge_id: match.challenge_id,
    });
    if (error) {
      setConfirmState("error");
      setErrorMsg(error.message);
      // Toast no bloqueante con acción de reintento inmediato
      toast.error("No se pudo confirmar", {
        description: error.message,
        action: { label: "Reintentar", onClick: () => void confirmLadder() },
      });
      return;
    }
    setConfirmState("idle");
    toast.success("Resultado confirmado");
    void qc.invalidateQueries({ queryKey: ["match-history", userId] });
    void qc.invalidateQueries({ queryKey: ["pending-actions"] });
    void qc.invalidateQueries({ queryKey: ["profile-summary", userId] });
  };

  // Deep-link al detalle del desafío en /ranking (la página acepta ?focus=challenges&open=<id>
  // y, si no existe, simplemente abre la pestaña de Pirámide con foco en challenges).
  const ladderHref = `/ranking?tab=piramide&focus=challenges&open=${match.challenge_id}`;

  return (
    <li
      className={cn(
        "flex items-start gap-3 rounded-2xl border p-3",
        isWait ? "border-border bg-card" : "border-warning/40 bg-warning/5",
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          badge.classes,
        )}
        aria-hidden
      >
        <Swords className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1">
          <span className={cn("rounded-full px-1.5 py-0.5 text-[9px] font-medium", badge.classes)}>
            Pirámide
          </span>
          <StatusBadge status={status} />
          {isOverdue && !isWait && <OverdueBadge />}
        </div>
        <p className="mt-1 truncate text-xs font-semibold leading-tight">vs {match.opponent_name}</p>
        <p className="truncate text-[10px] text-muted-foreground">{match.ladder_name}</p>
        <p
          className={cn(
            "flex items-center gap-1 text-[10px]",
            isOverdue && !isWait ? "font-semibold text-warning" : "text-muted-foreground",
          )}
        >
          <Clock className="h-2.5 w-2.5" />
          {dateLabel}
        </p>
      </div>
      {isConfirm ? (
        // Acción in-place: NO cerramos el sheet. Estados: idle / loading / error (reintento).
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Button
            size="sm"
            variant={confirmState === "error" ? "outline" : "default"}
            className={cn(
              "h-7 px-2.5 text-[10px]",
              confirmState === "error" && "border-destructive/60 text-destructive hover:bg-destructive/10",
            )}
            disabled={confirmState === "loading"}
            onClick={confirmLadder}
            aria-label={
              confirmState === "error"
                ? `Reintentar confirmar resultado vs ${match.opponent_name}`
                : `Confirmar resultado vs ${match.opponent_name}`
            }
            aria-busy={confirmState === "loading"}
          >
            {confirmState === "loading" ? (
              <>
                <Loader2 className="mr-0.5 h-3 w-3 animate-spin" /> Enviando…
              </>
            ) : confirmState === "error" ? (
              <>
                <AlertCircle className="mr-0.5 h-3 w-3" /> Reintentar
              </>
            ) : (
              <>
                <Check className="mr-0.5 h-3 w-3" /> Confirmar
              </>
            )}
          </Button>
          {confirmState === "error" && errorMsg && (
            <span
              className="max-w-[140px] truncate text-right text-[9px] font-medium text-destructive"
              title={errorMsg}
              role="alert"
            >
              {errorMsg}
            </span>
          )}
        </div>
      ) : (
        // "Cargar" → cierra y va a /ranking. "Ver" → mantiene el sheet abierto.
        <Button
          asChild
          size="sm"
          variant={isWait ? "ghost" : "default"}
          className="h-7 shrink-0 px-2.5 text-[10px]"
          onClick={() => {
            if (isSubmit) onClose();
          }}
        >
          <Link to={ladderHref} aria-label={`${isWait ? "Ver" : "Cargar"} desafío vs ${match.opponent_name}`}>
            {isWait ? "Ver" : "Cargar"}
            <ArrowRight className="ml-0.5 h-3 w-3" />
          </Link>
        </Button>
      )}
    </li>
  );
});
PendingLadderRow.displayName = "PendingLadderRow";
