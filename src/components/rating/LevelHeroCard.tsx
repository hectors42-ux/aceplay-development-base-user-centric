import { TrendingUp, TrendingDown, Minus, Info, ArrowRight, Flame } from "lucide-react";
import { Link } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  formatLevel,
  formatDelta,
  getDeltaColor,
  getLevelBand,
  getReliabilityLabel,
  getReliabilityHint,
  RATING_SPORT_LABEL,
  type RatingSport,
} from "@/lib/rating-utils";
import { cn, formatStreakLabel, formatStreakLabelShort } from "@/lib/utils";

export type ClubCategory = "A" | "B" | "C";

interface Props {
  /** Nivel 1.0 – 7.0 */
  level: number | null;
  /** Categoría derivada A/B/C */
  category: ClubCategory | null;
  /** Δ del último match (positivo, negativo o 0) */
  delta?: number;
  /** Deporte para etiqueta superior */
  sport: RatingSport;
  /** Posiciones del usuario (omitir si no aplica) */
  rankingPosition?: number | null;
  ladderPosition?: number | null;
  ladderStatus?: string | null;
  /** Racha (positiva = victorias, negativa = derrotas) */
  streak?: number;
  /** Datos de fiabilidad (solo se muestran en variant="full") */
  reliability?: number;
  matchesPlayed?: number;
  /** Variante visual */
  variant?: "slim" | "full";
  /** Loading skeleton */
  loading?: boolean;
  /** Si true, toda la card es clicable hacia /perfil (slim) */
  linkToProfile?: boolean;
  /** Botón inferior "Ver evolución completa" (solo full) — versión link */
  seeMoreHref?: string;
  /** Botón inferior "Ver evolución completa" (solo full) — versión callback (preferido) */
  onSeeMore?: () => void;
  /** Override del título (defecto: "Tu nivel") */
  title?: string;
  /** Clases extra para el wrapper (e.g. min-h para alinear con otros heros) */
  className?: string;
}

export const LevelHeroCard = ({
  level,
  category,
  delta = 0,
  sport,
  rankingPosition = null,
  ladderPosition = null,
  ladderStatus = null,
  streak = 0,
  reliability,
  matchesPlayed,
  variant = "full",
  loading = false,
  linkToProfile = false,
  seeMoreHref,
  onSeeMore,
  title = "Tu nivel",
  className,
}: Props) => {
  if (loading) {
    return (
      <Skeleton
        className={cn(
          "w-full rounded-[28px]",
          // min-h base; si className aporta otro min-h (Home: 260/280px) lo sobrescribe.
          variant === "slim" ? "min-h-[200px]" : "min-h-[300px]",
          className,
        )}
      />
    );
  }

  if (level == null) {
    const onboardingSport = sport === "padel" ? "padel" : "tenis";
    return (
      <Link
        to={`/onboarding/nivel?sport=${onboardingSport}`}
        className={cn("flex flex-col items-center justify-center gap-2 rounded-[28px] border border-dashed border-border bg-card p-8 text-center shadow-card transition-smooth hover:bg-muted", className)}
      >
        <p className="text-sm font-medium text-foreground">Aún no tienes nivel</p>
        <p className="text-xs text-muted-foreground">
          Responde el cuestionario para conocer tu nivel
        </p>
      </Link>
    );
  }

  const band = getLevelBand(level);
  const cat = category;
  const DeltaIcon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
  const showPositions = rankingPosition !== null || ladderPosition !== null || ladderStatus !== null;

  // Hero superior (común a slim y full).
  const top = (
    <div className="relative flex-1 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent px-5 pb-4 pt-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {title} · {RATING_SPORT_LABEL[sport]}
          </p>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-[44px] font-semibold leading-none tracking-tight text-foreground sm:text-[52px]">
              {formatLevel(level)}
            </span>
            <span className="text-xs font-medium text-muted-foreground">/ 7.0</span>
          </div>
          <p className={cn("text-sm font-medium", band.color)}>{band.label}</p>
        </div>

        <div className="flex shrink-0 items-start gap-2">
          {streak !== 0 && (
            <span
              className={cn(
                "inline-flex items-center gap-1 self-start whitespace-nowrap rounded-full px-2 py-1 text-[11px] font-bold",
                streak > 0 ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive",
              )}
              title={formatStreakLabel(streak)}
            >
              {streak > 0 && <Flame className="h-3 w-3" />}
              <span className="sm:hidden">{formatStreakLabelShort(streak)}</span>
              <span className="hidden sm:inline">{formatStreakLabel(streak)}</span>
            </span>
          )}
          {cat && (
            <div
              className="flex flex-col items-center gap-0.5 rounded-2xl bg-primary/15 px-3 py-2"
              aria-label={`Categoría ${cat}`}
            >
              <span className="font-display text-base font-bold leading-none text-primary text-center">
                {cat}
              </span>
              <span className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
                Cat.
              </span>
            </div>
          )}
        </div>
      </div>

      {delta !== 0 && (
        <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-background/60 px-3 py-1 backdrop-blur-sm">
          <DeltaIcon
            className={cn("h-3.5 w-3.5", getDeltaColor(delta))}
            strokeWidth={2.5}
          />
          <span className={cn("text-xs font-medium", getDeltaColor(delta))}>
            {formatDelta(delta)} último match
          </span>
        </div>
      )}

      {/* Posiciones: ranking + Pirámide */}
      {showPositions && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-2xl border border-border/60 bg-background/40 p-3">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
              Ranking
            </p>
            <p className="mt-1 font-display text-xl font-bold leading-none">
              {rankingPosition ? `#${rankingPosition}` : "—"}
            </p>
            <p className="mt-1 text-[10px] text-muted-foreground">
              {sport === "tenis_singles" ? "Singles" : sport === "tenis_dobles" ? "Dobles" : RATING_SPORT_LABEL[sport]} del club
            </p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-background/40 p-3">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
              Pirámide
            </p>
            <p className="mt-1 font-display text-xl font-bold leading-none">
              {ladderPosition ? `#${ladderPosition}` : "—"}
            </p>
            <p className="mt-1 text-[10px] text-muted-foreground">
              {ladderStatus ?? "no inscrito"}
            </p>
          </div>
        </div>
      )}
    </div>
  );

  // Bloque inferior (solo full): fiabilidad + acción opcional.
  const bottom = variant === "full" && reliability !== undefined && (
    <div className="space-y-2 border-t border-border px-5 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Fiabilidad</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger
                onClick={(e) => e.preventDefault()}
                className="text-muted-foreground"
                aria-label="¿Qué es la fiabilidad?"
              >
                <Info className="h-3 w-3" />
              </TooltipTrigger>
              <TooltipContent className="max-w-[240px] text-xs">
                {getReliabilityHint(reliability)}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <span className="text-xs font-semibold text-foreground">
          {reliability}% · {getReliabilityLabel(reliability)}
        </span>
      </div>
      <Progress value={reliability} className="h-1.5" />
      {matchesPlayed !== undefined && (
        <p className="text-[11px] text-muted-foreground">
          {matchesPlayed} {matchesPlayed === 1 ? "match jugado" : "matches jugados"}
        </p>
      )}
      {(onSeeMore || seeMoreHref) && (
        onSeeMore ? (
          <Button
            type="button"
            onClick={onSeeMore}
            variant="ghost"
            size="sm"
            className="mt-1 h-8 w-full justify-between text-[11px]"
          >
            <span>Ver evolución completa</span>
            <ArrowRight className="h-3 w-3" />
          </Button>
        ) : (
          <Button asChild variant="ghost" size="sm" className="mt-1 h-8 w-full justify-between text-[11px]">
            <Link to={seeMoreHref!}>
              <span>Ver evolución completa</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </Button>
        )
      )}
    </div>
  );

  const wrapperClasses = cn(
    "flex flex-col overflow-hidden rounded-[28px] border border-border bg-card transition-smooth",
    variant === "full" ? "shadow-elevated" : "shadow-card",
    linkToProfile && "active:scale-[0.99] hover:bg-card/95",
    className,
  );

  if (linkToProfile) {
    return (
      <Link to="/perfil" aria-label={`${title} ${formatLevel(level)} · ${band.label}`} className={wrapperClasses}>
        {top}
        {bottom}
      </Link>
    );
  }

  return (
    <div className={wrapperClasses}>
      {top}
      {bottom}
    </div>
  );
};
