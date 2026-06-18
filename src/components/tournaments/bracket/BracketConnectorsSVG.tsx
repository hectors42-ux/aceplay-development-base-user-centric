import { Fragment, useMemo } from "react";
import { AnimatedPath } from "@/components/feedback/AnimatedPath";
import type { Match } from "@/hooks/useCategoryData";

interface Connector {
  id: string;
  d: string;
  lit: boolean;
  dim: boolean;
  delay: number;
}

interface Props {
  matches: Match[];
  colWidth: number;
  colGap: number;
  matchHeight: number;
  baseGap: number;
  totalRounds: number;
  myPathMatchIds?: Set<string>;
  myPathActive?: boolean;
}

/**
 * Capa SVG absoluta detrás de los nodos. Calcula la geometría de los conectores
 * "elbow" replicando el layout flex del BracketView (columnas con padding-top y
 * gap exponencial por ronda).
 */
export function BracketConnectorsSVG({
  matches,
  colWidth,
  colGap,
  matchHeight,
  baseGap,
  totalRounds,
  myPathMatchIds,
  myPathActive,
}: Props) {
  const connectors = useMemo<Connector[]>(() => {
    if (matches.length === 0) return [];
    const byRound: Record<number, Match[]> = {};
    for (const m of matches) (byRound[m.round] ||= []).push(m);
    for (const r of Object.keys(byRound))
      byRound[Number(r)].sort((a, b) => a.bracket_position - b.bracket_position);
    const rounds = Object.keys(byRound)
      .map(Number)
      .sort((a, b) => b - a);

    // Centro Y de cada match: replica el flex del BracketView
    // Header h4 mb-3 ≈ 28px alto + 12px margen ≈ 40px offset inicial
    const HEADER_OFFSET = 40;
    const yByMatchId = new Map<string, number>();
    const xRightByMatchId = new Map<string, number>();
    const xLeftByMatchId = new Map<string, number>();

    rounds.forEach((r, colIdx) => {
      const stepFromFirst = totalRounds - r;
      const matchSlot = matchHeight * Math.pow(2, stepFromFirst);
      const gap = baseGap * Math.pow(2, stepFromFirst);
      const paddingTop = colIdx === 0 ? 0 : (matchSlot - matchHeight) / 2;
      const colX = colIdx * (colWidth + colGap);
      const list = byRound[r];
      list.forEach((m, idx) => {
        const y = HEADER_OFFSET + paddingTop + idx * (matchHeight + gap) + matchHeight / 2;
        yByMatchId.set(m.id, y);
        xLeftByMatchId.set(m.id, colX);
        xRightByMatchId.set(m.id, colX + colWidth);
      });
    });

    // Para cada match en ronda r (r>1) conectamos a su padre en r-1:
    // padre bracket_position = ceil(pos/2)
    const result: Connector[] = [];
    for (const m of matches) {
      if (m.round <= 1) continue;
      const parentPos = Math.ceil(m.bracket_position / 2);
      const bracketCol = (m as { bracket?: string | null }).bracket ?? null;
      const parent = matches.find(
        (p) =>
          p.round === m.round - 1 &&
          p.bracket_position === parentPos &&
          (((p as { bracket?: string | null }).bracket ?? null) === bracketCol),
      );
      if (!parent) continue;
      const fromX = xRightByMatchId.get(m.id);
      const fromY = yByMatchId.get(m.id);
      const toX = xLeftByMatchId.get(parent.id);
      const toY = yByMatchId.get(parent.id);
      if (fromX == null || fromY == null || toX == null || toY == null) continue;
      const midX = (fromX + toX) / 2;
      const d = `M ${fromX} ${fromY} L ${midX} ${fromY} L ${midX} ${toY} L ${toX} ${toY}`;
      const lit = !!m.winner_registration_id;
      const inPath =
        !myPathActive ||
        ((myPathMatchIds?.has(m.id) ?? false) && (myPathMatchIds?.has(parent.id) ?? false));
      result.push({
        id: `${m.id}-${parent.id}`,
        d,
        lit,
        dim: !inPath,
        delay: m.bracket_position * 50,
      });
    }
    return result;
  }, [matches, colWidth, colGap, matchHeight, baseGap, totalRounds, myPathMatchIds, myPathActive]);

  if (connectors.length === 0) return null;

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden
      style={{ overflow: "visible" }}
    >
      {connectors.map((c) => (
        <Fragment key={c.id}>
          <path
            d={c.d}
            stroke="hsl(var(--border))"
            strokeWidth={1.5}
            fill="none"
            style={{
              opacity: c.dim ? 0.25 : 1,
              transition: "opacity 250ms ease",
            }}
          />
          {c.lit && (
            <g style={{ opacity: c.dim ? 0.3 : 1, transition: "opacity 250ms ease" }}>
              <AnimatedPath d={c.d} delay={c.delay} />
            </g>
          )}
        </Fragment>
      ))}
    </svg>
  );
}