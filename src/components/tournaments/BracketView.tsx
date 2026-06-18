import { useEffect, useRef, useState } from "react";
import { Trophy, CalendarClock, MapPin, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Match, Registration, Player, Court, registrationLabel } from "@/hooks/useCategoryData";
import { roundLabel, formatScore, totalRoundsForMatches } from "@/lib/tournament-utils";
import { cn } from "@/lib/utils";
import { BracketConnectorsSVG } from "./bracket/BracketConnectorsSVG";

interface BracketViewProps {
  matches: Match[];
  registrations: Registration[];
  players: Map<string, Player>;
  courts?: Court[];
  highlightUserId?: string;
  onMatchClick?: (match: Match) => void;
  myPathMatchIds?: Set<string>;
  myPathActive?: boolean;
}

// Constantes de layout (para conectores y espaciado)
const MATCH_HEIGHT = 110; // alto aprox por partido (2 filas + footer + meta)
const BASE_GAP = 14;
const COL_WIDTH = 240;
const COL_GAP = 28;
const ASSUMED_DURATION_MIN = 90; // duración asumida por partido para detectar "en vivo"

export const BracketView = ({
  matches,
  registrations,
  players,
  courts,
  highlightUserId,
  onMatchClick,
  myPathMatchIds,
  myPathActive,
}: BracketViewProps) => {
  // tick para refrescar el estado "en vivo" cada 30s
  const [, setNowTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setNowTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  if (matches.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/50 p-6 text-center text-sm text-muted-foreground">
        La llave aún no ha sido generada.
      </div>
    );
  }

  const totalRounds = totalRoundsForMatches(matches);
  const regsById = new Map(registrations.map((r) => [r.id, r]));
  const courtsById = new Map((courts ?? []).map((c) => [c.id, c]));

  const byRound: Record<number, Match[]> = {};
  for (const m of matches) {
    (byRound[m.round] ||= []).push(m);
  }
  for (const r of Object.keys(byRound)) {
    byRound[Number(r)].sort((a, b) => a.bracket_position - b.bracket_position);
  }
  const rounds = Object.keys(byRound)
    .map(Number)
    .sort((a, b) => b - a);

  const isUserInReg = (regId: string | null) => {
    if (!highlightUserId || !regId) return false;
    const r = regsById.get(regId);
    if (!r) return false;
    return r.player1_user_id === highlightUserId || r.player2_user_id === highlightUserId;
  };

  const isLive = (m: Match): boolean => {
    if (!m.scheduled_at || m.status !== "programado") return false;
    const start = parseISO(m.scheduled_at).getTime();
    const end = start + ASSUMED_DURATION_MIN * 60 * 1000;
    const now = Date.now();
    return now >= start && now <= end;
  };

  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const MIN_ZOOM = 0.4;
  const MAX_ZOOM = 1.6;
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1);
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);
  const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
  const setZoomAt = (next: number, clientX?: number, clientY?: number) => {
    const el = scrollRef.current;
    const nz = clampZoom(next);
    if (!el) {
      setZoom(nz);
      return;
    }
    const rect = el.getBoundingClientRect();
    const cx = clientX ?? rect.left + rect.width / 2;
    const cy = clientY ?? rect.top + rect.height / 2;
    const offsetX = cx - rect.left + el.scrollLeft;
    const offsetY = cy - rect.top + el.scrollTop;
    const ratio = nz / zoomRef.current;
    setZoom(nz);
    requestAnimationFrame(() => {
      if (!scrollRef.current) return;
      scrollRef.current.scrollLeft = offsetX * ratio - (cx - rect.left);
      scrollRef.current.scrollTop = offsetY * ratio - (cy - rect.top);
    });
  };

  const activePointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchRef = useRef<{ dist: number; zoom: number; cx: number; cy: number } | null>(null);

  const dragState = useRef<{
    active: boolean;
    moved: boolean;
    startX: number;
    startY: number;
    scrollLeft: number;
    scrollTop: number;
    pointerId: number | null;
  }>({ active: false, moved: false, startX: 0, startY: 0, scrollLeft: 0, scrollTop: 0, pointerId: null });

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (activePointers.current.size === 2) {
      // Iniciar pinch
      const pts = Array.from(activePointers.current.values());
      const dx = pts[0].x - pts[1].x;
      const dy = pts[0].y - pts[1].y;
      pinchRef.current = {
        dist: Math.hypot(dx, dy),
        zoom: zoomRef.current,
        cx: (pts[0].x + pts[1].x) / 2,
        cy: (pts[0].y + pts[1].y) / 2,
      };
      dragState.current.active = false;
      return;
    }
    // Solo arrastrar con mouse/pen; en touch dejamos el scroll nativo
    if (e.pointerType === "touch") return;
    const el = scrollRef.current;
    if (!el) return;
    dragState.current = {
      active: true,
      moved: false,
      startX: e.clientX,
      startY: e.clientY,
      scrollLeft: el.scrollLeft,
      scrollTop: el.scrollTop,
      pointerId: e.pointerId,
    };
    el.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointers.current.has(e.pointerId)) {
      activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
    if (pinchRef.current && activePointers.current.size >= 2) {
      const pts = Array.from(activePointers.current.values()).slice(0, 2);
      const dx = pts[0].x - pts[1].x;
      const dy = pts[0].y - pts[1].y;
      const dist = Math.hypot(dx, dy);
      const factor = dist / pinchRef.current.dist;
      setZoomAt(pinchRef.current.zoom * factor, pinchRef.current.cx, pinchRef.current.cy);
      return;
    }
    const s = dragState.current;
    if (!s.active) return;
    const el = scrollRef.current;
    if (!el) return;
    const dx = e.clientX - s.startX;
    const dy = e.clientY - s.startY;
    if (!s.moved && Math.hypot(dx, dy) > 4) s.moved = true;
    el.scrollLeft = s.scrollLeft - dx;
    el.scrollTop = s.scrollTop - dy;
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    activePointers.current.delete(e.pointerId);
    if (activePointers.current.size < 2) pinchRef.current = null;
    const s = dragState.current;
    if (!s.active) return;
    const el = scrollRef.current;
    if (el && s.pointerId !== null && el.hasPointerCapture(s.pointerId)) {
      el.releasePointerCapture(s.pointerId);
    }
    s.active = false;
    s.pointerId = null;
  };

  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    const delta = -e.deltaY * 0.0015;
    setZoomAt(zoomRef.current * (1 + delta), e.clientX, e.clientY);
  };

  const fitToView = () => {
    const el = scrollRef.current;
    const inner = contentRef.current;
    if (!el || !inner) {
      setZoom(1);
      return;
    }
    // Medir tamaño natural (sin escala actual)
    const naturalW = inner.scrollWidth / zoomRef.current;
    const naturalH = inner.scrollHeight / zoomRef.current;
    const fit = Math.min(el.clientWidth / naturalW, el.clientHeight / naturalH);
    setZoom(clampZoom(fit));
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollLeft = 0;
        scrollRef.current.scrollTop = 0;
      }
    });
  };

  const onClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    // Evita que un drag dispare clicks en los partidos
    if (dragState.current.moved) {
      e.stopPropagation();
      e.preventDefault();
      dragState.current.moved = false;
    }
  };

  return (
    <div className="relative">
      <div className="pointer-events-none absolute right-2 top-2 z-10 flex items-center gap-1">
        <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-border bg-background/85 px-1 py-1 shadow-card backdrop-blur">
          <button
            type="button"
            onClick={() => setZoomAt(zoomRef.current - 0.15)}
            className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
            disabled={zoom <= MIN_ZOOM + 0.001}
            aria-label="Alejar"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <span className="min-w-[2.5rem] text-center text-[10px] font-medium tabular-nums text-muted-foreground">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setZoomAt(zoomRef.current + 0.15)}
            className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
            disabled={zoom >= MAX_ZOOM - 0.001}
            aria-label="Acercar"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={fitToView}
            className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Ajustar a la vista"
            title="Ajustar a la vista"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div
        ref={scrollRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={onClickCapture}
        onWheel={onWheel}
        className="scrollbar-none overflow-auto overscroll-contain pb-2 max-h-[70vh] cursor-grab active:cursor-grabbing touch-none select-none"
        style={{ WebkitOverflowScrolling: "touch" }}
        role="region"
        aria-label="Llave del torneo"
      >
        <div
          ref={contentRef}
          className="relative flex min-w-max origin-top-left"
          style={{ gap: `${COL_GAP}px`, transform: `scale(${zoom})`, transformOrigin: "top left" }}
        >
        <BracketConnectorsSVG
          matches={matches}
          colWidth={COL_WIDTH}
          colGap={COL_GAP}
          matchHeight={MATCH_HEIGHT}
          baseGap={BASE_GAP}
          totalRounds={totalRounds}
          myPathMatchIds={myPathMatchIds}
          myPathActive={myPathActive}
        />

        {rounds.map((r, colIdx) => {
          const stepFromFirst = totalRounds - r; // 0 = primera ronda
          const matchSlot = MATCH_HEIGHT * Math.pow(2, stepFromFirst);
          const gap = BASE_GAP * Math.pow(2, stepFromFirst);
          const paddingTop = colIdx === 0 ? 0 : (matchSlot - MATCH_HEIGHT) / 2;
          const isFinal = r === 1;
          return (
            <div
              key={r}
              className="relative flex shrink-0 flex-col"
              style={{ width: COL_WIDTH }}
            >
              <h4 className="mb-3 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {roundLabel(r, totalRounds)}
                {isFinal && <span className="ml-1 text-primary">★</span>}
              </h4>
              <div
                className="relative flex flex-col"
                style={{
                  gap: `${gap}px`,
                  paddingTop: `${paddingTop}px`,
                }}
              >
                {byRound[r].map((m, idx) => {
                  const regA = m.registration_a_id ? regsById.get(m.registration_a_id) : undefined;
                  const regB = m.registration_b_id ? regsById.get(m.registration_b_id) : undefined;
                  const winnerIsA = m.winner_registration_id && m.winner_registration_id === m.registration_a_id;
                  const winnerIsB = m.winner_registration_id && m.winner_registration_id === m.registration_b_id;
                  const userInA = isUserInReg(m.registration_a_id);
                  const userInB = isUserInReg(m.registration_b_id);
                  const userInMatch = userInA || userInB;
                  const isPlayed = m.status === "jugado";
                  const live = isLive(m);
                  const court = m.court_id ? courtsById.get(m.court_id) : undefined;
                  const dim = !!myPathActive && !!myPathMatchIds && !myPathMatchIds.has(m.id);
                  return (
                    <div
                      key={m.id}
                      className="relative transition-opacity duration-300"
                      style={dim ? { opacity: 0.3 } : undefined}
                    >
                      {live && (
                        <span className="pointer-events-none absolute -top-2 left-2 z-10 rounded bg-primary px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wider text-primary-foreground shadow-card">
                          En juego
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => onMatchClick?.(m)}
                        className={cn(
                          "flex w-full flex-col overflow-hidden rounded-2xl border bg-card text-left transition-smooth",
                          isPlayed
                            ? "border-emerald-500/40 shadow-card"
                            : live
                              ? "border-[1.6px] border-primary ring-2 ring-primary/30 shadow-card glow"
                              : userInMatch
                                ? "border-primary/60 ring-1 ring-primary/30 shadow-card"
                                : "border-border",
                          onMatchClick && "hover:-translate-y-0.5 hover:shadow-clay focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                        )}
                        aria-label={`Partido ${m.bracket_position}, ronda ${roundLabel(m.round, totalRounds)}`}
                      >
                        <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/30 px-3 py-1.5">
                          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                            #{m.bracket_position}
                          </span>
                          {live && (
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-primary">
                              Live
                            </span>
                          )}
                          {!live && isPlayed && (
                            <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                              <Trophy className="h-3 w-3" /> Jugado
                            </span>
                          )}
                        </div>
                        <PlayerRow
                          label={registrationLabel(regA, players)}
                          isWinner={!!winnerIsA}
                          isUser={userInA}
                          isBye={!regA}
                          isLoserHighlight={isPlayed && !winnerIsA && !!regA}
                        />
                        <div className="h-px bg-border" />
                        <PlayerRow
                          label={registrationLabel(regB, players)}
                          isWinner={!!winnerIsB}
                          isUser={userInB}
                          isBye={!regB}
                          isLoserHighlight={isPlayed && !winnerIsB && !!regB}
                        />
                        {(m.scheduled_at || court || m.score) && (
                          <div className="border-t border-border bg-background/50 px-3 py-1.5 text-[10px] text-muted-foreground">
                            {m.score && (
                              <p className="font-mono">
                                {formatScore(m.score)}
                                {m.walkover && " · W.O."}
                                {m.retired && " · ret."}
                              </p>
                            )}
                            {!m.score && m.scheduled_at && (
                              <p className="flex items-center gap-1">
                                <CalendarClock className="h-3 w-3" />
                                {format(parseISO(m.scheduled_at), "EEE d MMM HH:mm", { locale: es })}
                                {court && (
                                  <>
                                    {" · "}
                                    <MapPin className="h-3 w-3" />
                                    {court.name}
                                  </>
                                )}
                              </p>
                            )}
                          </div>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
    </div>
  );
};

const PlayerRow = ({
  label,
  isWinner,
  isUser,
  isBye,
  isLoserHighlight,
}: {
  label: string;
  isWinner: boolean;
  isUser: boolean;
  isBye: boolean;
  isLoserHighlight?: boolean;
}) => (
  <div
    className={cn(
      "flex items-center gap-2 px-3 py-2 text-xs",
      isWinner && "bg-emerald-500/10",
      isLoserHighlight && "opacity-60",
      isBye && "italic text-muted-foreground/60",
    )}
  >
    <span
      className={cn(
        "h-1.5 w-1.5 shrink-0 rounded-full transition-colors",
        isWinner ? "bg-emerald-500" : "bg-transparent",
      )}
    />
    <span
      className={cn(
        "flex-1 truncate",
        isWinner && "font-semibold text-foreground",
        isUser && !isWinner && "text-primary",
        isUser && isWinner && "text-emerald-700 dark:text-emerald-300",
      )}
    >
      {label}
    </span>
  </div>
);
