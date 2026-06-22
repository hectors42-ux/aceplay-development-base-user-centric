import { TrendingUp, TrendingDown, Minus, Info, Trophy } from "lucide-react";
import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
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
  type PlayerRatingRow,
} from "@/lib/rating-utils";
import type { ClubCategory } from "@/hooks/useMyRatingWithCategory";
import { cn } from "@/lib/utils";

interface Props {
  rating: PlayerRatingRow | null;
  category: ClubCategory | null;
  loading?: boolean;
  /** Si true, hace toda la card clicable hacia /perfil */
  linkToProfile?: boolean;
  /** "default" = layout vertical original; "compact" = una fila ~96px para Home */
  variant?: "default" | "compact";
}

const CATEGORY_STYLES: Record<ClubCategory, { bg: string; text: string; label: string }> = {
  A: { bg: "bg-success/15", text: "text-success", label: "Categoría A" },
  B: { bg: "bg-primary/15", text: "text-primary", label: "Categoría B" },
  C: { bg: "bg-accent/20", text: "text-accent-foreground", label: "Categoría C" },
};

export const PlayerRatingCard = ({
  rating,
  category,
  loading,
  linkToProfile = true,
  variant = "default",
}: Props) => {
  if (loading) {
    return (
      <section className="px-5">
        <Skeleton className={cn("w-full rounded-[28px]", variant === "compact" ? "h-[96px] rounded-2xl" : "h-[220px]")} />
      </section>
    );
  }

  if (!rating) {
    return (
      <section className="px-5">
        <Link
          to="/onboarding/nivel"
          className="flex flex-col items-center justify-center gap-2 rounded-[28px] border border-dashed border-border bg-card p-8 text-center shadow-card transition-smooth hover:bg-muted"
        >
          <Trophy className="h-8 w-8 text-primary" strokeWidth={2} />
          <p className="text-sm font-medium text-foreground">Aún no tienes nivel</p>
          <p className="text-xs text-muted-foreground">
            Responde el cuestionario para conocer tu nivel
          </p>
        </Link>
      </section>
    );
  }

  const band = getLevelBand(rating.level);
  const delta = Number(rating.last_change_delta || 0);
  const reliability = rating.reliability;
  const reliabilityLabel = getReliabilityLabel(reliability);
  const cat = category ?? "C";
  // La categoría ahora puede ser el label real del escalafón (p. ej. "Cuarta"); si no
  // coincide con A/B/C usamos un estilo neutro para no romper (Perfil/partner; pieza posterior).
  const catStyle = CATEGORY_STYLES[cat] ?? CATEGORY_STYLES.C;

  const Wrapper = linkToProfile ? Link : "div";
  const wrapperProps = linkToProfile ? { to: "/perfil" } : {};

  const DeltaIcon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;

  // Variante compacta: una sola fila ~96px, pensada para Home (mismo alto que carruseles).
  if (variant === "compact") {
    return (
      <section className="px-5">
        <Wrapper
          {...(wrapperProps as { to: string })}
          aria-label={`Tu nivel ${formatLevel(rating.level)} · ${band.label}`}
          className="flex h-[96px] items-center gap-3 overflow-hidden rounded-2xl border border-border bg-card px-4 py-3 shadow-card transition-smooth active:scale-[0.99]"
        >
          {/* Izquierda: nivel + banda */}
          <div className="flex min-w-0 flex-col">
            <div className="flex items-baseline gap-1">
              <span className="font-display text-[36px] font-semibold leading-none tracking-tight text-foreground">
                {formatLevel(rating.level)}
              </span>
              <span className="text-[10px] font-medium text-muted-foreground">/7.0</span>
            </div>
            <p className={cn("mt-0.5 truncate text-[11px] font-medium", band.color)}>
              {band.label}
            </p>
          </div>

          {/* Centro: chip categoría */}
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
              catStyle.bg,
            )}
            aria-label={catStyle.label}
          >
            <span className={cn("font-display text-base font-bold leading-none", catStyle.text)}>
              {cat}
            </span>
          </div>

          {/* Derecha: delta + fiabilidad mini */}
          <div className="ml-auto flex min-w-0 flex-1 flex-col items-end gap-1">
            {delta !== 0 ? (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 text-[11px] font-semibold tabular-nums",
                  getDeltaColor(delta),
                )}
              >
                <DeltaIcon className="h-3 w-3" strokeWidth={2.5} />
                {formatDelta(delta)}
              </span>
            ) : (
              <span className="text-[11px] font-medium text-muted-foreground">Sin cambios</span>
            )}
            <div className="w-full max-w-[100px]">
              <Progress value={reliability} className="h-1" />
              <p className="mt-0.5 truncate text-right text-[9px] text-muted-foreground tabular-nums">
                {reliability}% · {reliabilityLabel}
              </p>
            </div>
          </div>
        </Wrapper>
      </section>
    );
  }

  return (
    <section className="px-5">
      <Wrapper
        {...(wrapperProps as { to: string })}
        className="block overflow-hidden rounded-[28px] border border-border bg-card shadow-elevated transition-smooth active:scale-[0.99]"
      >
        {/* Top: nivel grande estilo Playtomic */}
        <div className="relative bg-gradient-to-br from-primary/10 via-primary/5 to-transparent px-6 pb-5 pt-6">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Tu nivel · {RATING_SPORT_LABEL[rating.sport]}
              </p>
              <div className="flex items-baseline gap-2">
                <span className="font-display text-[56px] font-semibold leading-none tracking-tight text-foreground">
                  {formatLevel(rating.level)}
                </span>
                <span className="text-sm font-medium text-muted-foreground">/ 7.0</span>
              </div>
              <p className={cn("text-sm font-medium", band.color)}>{band.label}</p>
            </div>

            <div
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-2xl px-3 py-2",
                catStyle.bg,
              )}
            >
              <span className={cn("text-2xl font-bold leading-none", catStyle.text)}>
                {cat}
              </span>
              <span className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
                Cat.
              </span>
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
        </div>

        {/* Bottom: reliability */}
        <div className="space-y-2 border-t border-border px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                Fiabilidad
              </span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger
                    onClick={(e) => e.preventDefault()}
                    className="text-muted-foreground"
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
              {reliability}% · {reliabilityLabel}
            </span>
          </div>
          <Progress value={reliability} className="h-1.5" />
          <p className="text-[11px] text-muted-foreground">
            {rating.matches_played} {rating.matches_played === 1 ? "match jugado" : "matches jugados"}
          </p>
        </div>
      </Wrapper>
    </section>
  );
};
