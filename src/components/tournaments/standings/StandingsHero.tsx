import { Flame } from "lucide-react";
import { useCountUp } from "@/components/feedback";
import { getRelegationZone } from "@/lib/tournament-utils";

export interface StandingsHeroProps {
  position: number;
  total: number;
  pj: number;
  pg: number;
  pp: number;
  points: number;
  pointsDecimals?: number;
  delta?: number; // positions ganadas esta semana; 0 oculta el chip
  consecutiveWins?: number; // >=3 muestra streak pill
  tailWinsNeeded?: number; // si > 0 y isTail, muestra mensaje específico
}

export function StandingsHero(props: StandingsHeroProps) {
  const {
    position,
    total,
    pj,
    pg,
    pp,
    points,
    pointsDecimals = 2,
    delta = 0,
    consecutiveWins = 0,
    tailWinsNeeded,
  } = props;

  const zone = getRelegationZone(position, total);
  const isWarning = zone === "warning";
  const isTail = zone === "danger";
  const isAnyZone = isWarning || isTail;
  const posDisplay = useCountUp(position, { duration: 900 });
  const pjDisplay = useCountUp(pj, { duration: 700 });
  const pgDisplay = useCountUp(pg, { duration: 700 });
  const ppDisplay = useCountUp(pp, { duration: 700 });
  const ptsDisplay = useCountUp(points, { duration: 900, decimals: pointsDecimals });

  const eyebrow = isTail ? "Zona de cola" : isWarning ? "Zona en riesgo" : "Tu posición";
  const pillLabel = isTail ? "Cuidado" : isWarning ? "Atento" : "EN VIVO";

  const nextGoal = (() => {
    if (isAnyZone) return null;
    if (position <= 1) return "Defiende el #1";
    if (position <= 3) return `1 PG → #${position - 1}`;
    return "Sigue sumando";
  })();

  const bg = isTail
    ? { background: "linear-gradient(140deg, hsl(38 92% 58%), hsl(22 78% 42%))" }
    : isWarning
    ? { background: "linear-gradient(140deg, hsl(45 88% 60%), hsl(32 78% 48%))" }
    : { background: "var(--gradient-clay)" };

  return (
    <div
      className="shimmer-host rise-in mx-[18px] mb-4 rounded-[22px] p-5 text-white shadow-[0_18px_40px_-18px_hsl(var(--primary)/0.55)] lg:mx-auto lg:max-w-2xl tnum"
      style={bg}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.32em] text-white/80">
          {eyebrow}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
          {!isAnyZone && (
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/80 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
            </span>
          )}
          {pillLabel}
        </span>
      </div>

      <div className="mt-2 flex items-end justify-between gap-4">
        <div className="flex items-baseline gap-1.5">
          <span
            className="font-display font-semibold leading-[0.85] tracking-[-0.02em]"
            style={{ fontSize: 84 }}
          >
            {posDisplay}
          </span>
          <span className="text-base text-white/75">/{total || "—"}</span>
        </div>
        {nextGoal && !isAnyZone && (
          <div className="text-right">
            <div className="font-mono text-[9px] uppercase tracking-[0.32em] text-white/70">
              Próximo objetivo
            </div>
            <div className="font-display text-base leading-tight">{nextGoal}</div>
          </div>
        )}
      </div>

      {delta > 0 && (
        <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-1 text-[11px] font-semibold text-[hsl(48_90%_70%)]">
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
            <path d="M5 1 L9 7 H1 Z" fill="currentColor" />
          </svg>
          ↑{delta} esta semana
        </div>
      )}

      {isAnyZone && (
        <>
          <p className="mt-3 font-display text-[19px] leading-snug text-white">
            {isTail
              ? tailWinsNeeded && tailWinsNeeded > 0
                ? `Te faltan ${tailWinsNeeded} ${tailWinsNeeded === 1 ? "victoria" : "victorias"} para salir de la zona de cola.`
                : "Estás en la zona de cola. Suma una victoria para salir."
              : "Estás cerca de la zona de cola. Una victoria te aleja."}
          </p>
          <div className="mt-3 flex items-center gap-2 text-[11px] text-white/85">
            <RoadmapStep label="Próximo partido" active />
            <RoadmapArrow />
            <RoadmapStep label="Subir 1 posición" />
            <RoadmapArrow />
            <RoadmapStep label="Salir de zona" />
          </div>
        </>
      )}

      <div className="stagger mt-4 grid grid-cols-4 gap-2">
        <Chip label="PJ" value={pjDisplay} />
        <Chip label="PG" value={pgDisplay} />
        <Chip label="PP" value={ppDisplay} />
        <Chip label="Pts" value={ptsDisplay} />
      </div>

      {consecutiveWins >= 3 && (
        <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold text-white">
          <Flame className="streak h-3.5 w-3.5" />
          Racha · {consecutiveWins} PG
        </div>
      )}
    </div>
  );
}

function Chip({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-white/15 px-2 py-1.5 text-center backdrop-blur-sm">
      <div className="font-mono text-[9px] uppercase tracking-[0.32em] text-white/70">{label}</div>
      <div className="font-display text-lg leading-tight">{value}</div>
    </div>
  );
}

function RoadmapStep({ label, active = false }: { label: string; active?: boolean }) {
  return (
    <span
      className={`rounded-full px-2 py-1 font-mono text-[9px] uppercase tracking-[0.18em] ${
        active ? "bg-white/25 text-white" : "bg-white/10 text-white/70"
      }`}
    >
      {label}
    </span>
  );
}

function RoadmapArrow() {
  return <span className="text-white/50">→</span>;
}