import { cn } from "@/lib/utils";
import { ArenaHero } from "./ArenaHero";
import { LeagueChip } from "./LeagueChip";
import { StreakChip } from "./StreakChip";
import { XPMeter } from "./XPMeter";
import { CoinPill } from "./CoinPill";
import type { Tier } from "./TierGem";

export interface LayerHudProps {
  // habilidad
  nivel: number;
  categoria: string;
  sport?: string;
  // enganche
  tier: Tier;
  division?: string;
  rank?: number;
  xpWeek: number;
  xpMax: number;
  streakWeeks: number;
  // premio
  fichas: number;
  onFichas?: () => void;
  className?: string;
}

// HUD de CAPAS, VISUALMENTE SEPARADAS para no confundir habilidad con enganche:
//   ┌ HABILIDAD ┐   Nivel/categoría (trofeo) — skill/volt
//   ├ ENGANCHE  ┤   Liga + Racha + XP semanal — constancia
//   └ PREMIO    ┘   Fichas (moneda → Tienda) — oro
// Cada grupo lleva su etiqueta de capa; la habilidad va arriba y aislada del
// resto para que "subir de Liga" jamás se lea como "subir de categoría".
export function LayerHud({
  nivel, categoria, sport,
  tier, division, rank, xpWeek, xpMax, streakWeeks,
  fichas, onFichas, className,
}: LayerHudProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {/* CAPA HABILIDAD */}
      <ArenaHero nivel={nivel} categoria={categoria} sport={sport} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
        {/* CAPA ENGANCHE */}
        <section aria-label="Constancia y enganche" className="rounded-2xl border border-border bg-card/60 p-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Constancia · enganche
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <LeagueChip tier={tier} division={division} rank={rank} />
            <StreakChip weeks={streakWeeks} />
          </div>
          <XPMeter value={xpWeek} max={xpMax} className="mt-3" />
        </section>

        {/* CAPA PREMIO */}
        <section aria-label="Premio" className="flex items-center justify-center rounded-2xl border border-border bg-card/60 p-3">
          <div className="text-center">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Premio</p>
            <CoinPill kind="fichas" value={fichas} onClick={onFichas} />
          </div>
        </section>
      </div>
    </div>
  );
}
