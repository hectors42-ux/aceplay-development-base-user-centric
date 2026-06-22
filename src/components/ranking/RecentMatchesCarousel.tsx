import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Check, X, Sparkles, GraduationCap, Settings2, Clock } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatLevel, formatDelta, getDeltaColor } from "@/lib/rating-utils";
import { cn } from "@/lib/utils";
import type { ProfileSummaryRecentMatch } from "@/hooks/useUserProfileSummary";

const SOURCE_LABEL: Record<string, string> = {
  ladder_challenge: "Escalerilla",
  match_ladder: "Escalerilla",
  tournament_match: "Torneo",
  match_tournament: "Torneo",
  match_open: "Amistoso",
  clase: "Clase",
  manual_admin: "Ajuste",
  manual_self: "Ajuste",
  decay: "Inactividad",
  onboarding: "Test inicial",
};

interface Props {
  matches: ProfileSummaryRecentMatch[];
  meName: string;
  meAvatar?: string | null;
  meLevel?: number | null;
  /** Tarjetas por slide en mobile. */
  basis?: string;
  /** Variante compacta para usar en Home (≈30% menos alto). */
  compact?: boolean;
}

const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase() || "?";

/** Parsea "6-3, 4-6, 7-5" → [["6","3"],["4","6"],["7","5"]] */
const parseScore = (s?: string | null): Array<[string, string]> => {
  if (!s) return [];
  return s
    .split(",")
    .map((p) => p.trim().split("-"))
    .filter((p) => p.length === 2)
    .map(([a, b]) => [a, b] as [string, string]);
};

const NON_VERSUS_SOURCES = new Set([
  "clase",
  "onboarding",
  "manual_admin",
  "manual_self",
  "decay",
]);

const ADJUSTMENT_META: Record<string, { icon: typeof Sparkles; title: string; subtitle: string }> = {
  clase: {
    icon: GraduationCap,
    title: "Clase con coach",
    subtitle: "Ajuste por entrenamiento",
  },
  onboarding: {
    icon: Sparkles,
    title: "Test inicial",
    subtitle: "Nivel asignado al ingresar",
  },
  manual_admin: {
    icon: Settings2,
    title: "Ajuste administrativo",
    subtitle: "Modificación del club",
  },
  manual_self: {
    icon: Settings2,
    title: "Ajuste propio",
    subtitle: "Recalibración manual",
  },
  decay: {
    icon: Clock,
    title: "Inactividad",
    subtitle: "Ajuste por falta de partidos",
  },
};

const MatchCard = ({
  m,
  meName,
  meAvatar,
  meLevel,
  compact = false,
}: {
  m: ProfileSummaryRecentMatch;
  meName: string;
  meAvatar?: string | null;
  meLevel?: number | null;
  compact?: boolean;
}) => {
  const sets = parseScore(m.score_summary);
  const hasOpponent = !NON_VERSUS_SOURCES.has(m.source) && !!m.opponent_name;
  const opponentName = m.opponent_name ?? "Rival";
  const Icon = m.won ? Check : X;
  const sourceLabel = SOURCE_LABEL[m.source] ?? m.source;
  const dateLabel = format(new Date(m.recorded_at), "d MMM yyyy", { locale: es });
  const adjustment = !hasOpponent ? ADJUSTMENT_META[m.source] ?? ADJUSTMENT_META.manual_admin : null;
  const AdjustmentIcon = adjustment?.icon ?? Settings2;

  // Variantes de tamaños — compactas para Home
  const v = {
    pad: compact ? "p-2 lg:p-3" : "p-2.5 sm:p-3",
    avatar: compact ? "h-5 w-5 lg:h-6 lg:w-6" : "h-6 w-6",
    avatarFallback: compact ? "text-[9px] lg:text-[10px]" : "text-[10px]",
    nameText: compact ? "text-[11px] lg:text-[13px]" : "text-xs",
    levelChip: compact ? "text-[9px] px-1 py-0.5 lg:text-[11px] lg:px-1.5" : "text-[10px] px-1 py-0.5",
    setChip: compact ? "h-5 min-w-5 text-[10px] sm:h-6 sm:min-w-6 sm:text-[11px] lg:h-7 lg:min-w-7 lg:text-[12px]" : "h-6 min-w-6 text-[11px]",
  };

  return (
    <div className={cn("flex h-full flex-col rounded-2xl border border-border bg-card shadow-card", v.pad)}>
      {/* Header */}
      <div className="mb-1.5 flex items-center justify-between text-[9px] font-medium uppercase tracking-wide leading-none text-muted-foreground sm:text-[10px]">
        <span className="truncate">{dateLabel}</span>
        <span className="ml-1 shrink-0 rounded-full bg-muted px-1.5 py-0.5 leading-none">{sourceLabel}</span>
      </div>

      {adjustment ? (
        /* === Layout horizontal SIN contrincante === */
        <div className="flex flex-1 items-center gap-2.5 py-1">
          <div className={cn(
            "flex shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary",
            compact ? "h-8 w-8" : "h-9 w-9 sm:h-10 sm:w-10",
          )}>
            <AdjustmentIcon className={cn(compact ? "h-3.5 w-3.5" : "h-4 w-4 sm:h-5 sm:w-5")} strokeWidth={2.2} />
          </div>
          <div className="min-w-0 flex-1">
            <p className={cn("truncate font-semibold leading-tight", v.nameText)}>{adjustment.title}</p>
            <p className="mt-0.5 truncate text-[10px] leading-tight text-muted-foreground">
              {adjustment.subtitle}
            </p>
            <span className="mt-1 inline-flex items-center rounded-full border border-dashed border-border bg-muted/40 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
              Sin contrincante
            </span>
          </div>
        </div>
      ) : (
        /* === Layout CON contrincante: jugadores arriba, marcador debajo === */
        <div className="flex flex-1 flex-col">
          {/* Jugadores */}
          <div className="space-y-1">
            {/* Yo */}
            <div className="flex items-center gap-1.5">
              <Avatar className={cn("shrink-0", v.avatar)}>
                <AvatarImage src={meAvatar ?? undefined} />
                <AvatarFallback className={v.avatarFallback}>{initials(meName)}</AvatarFallback>
              </Avatar>
              <span className={cn("min-w-0 flex-1 truncate font-semibold", v.nameText)}>{meName}</span>
              {meLevel != null && (
                <span className={cn("shrink-0 rounded-md bg-success/15 font-bold leading-none text-success", v.levelChip)}>
                  {formatLevel(meLevel)}
                </span>
              )}
            </div>

            {/* Rival */}
            <div className="flex items-center gap-1.5">
              <Avatar className={cn("shrink-0", v.avatar)}>
                <AvatarImage src={m.opponent_avatar ?? undefined} />
                <AvatarFallback className={v.avatarFallback}>{initials(opponentName)}</AvatarFallback>
              </Avatar>
              <span className={cn("min-w-0 flex-1 truncate font-semibold", v.nameText)}>{opponentName}</span>
            </div>
          </div>

          {/* Marcador en grid 2 filas (yo / rival) */}
          {sets.length > 0 ? (
            <div className="mt-2 rounded-lg border border-border/60 bg-muted/30 p-1.5">
              <div
                className="grid gap-1"
                style={{ gridTemplateColumns: `repeat(${sets.length}, minmax(0, 1fr))` }}
                role="table"
                aria-label="Marcador por set"
              >
                {/* Fila yo */}
                {sets.map((s, i) => (
                  <span
                    key={`me-${i}`}
                    className={cn(
                      "flex items-center justify-center rounded font-bold tabular-nums leading-none",
                      v.setChip,
                      Number(s[0]) > Number(s[1])
                        ? "bg-foreground text-background"
                        : "bg-background text-muted-foreground",
                    )}
                  >
                    {s[0]}
                  </span>
                ))}
                {/* Fila rival */}
                {sets.map((s, i) => (
                  <span
                    key={`op-${i}`}
                    className={cn(
                      "flex items-center justify-center rounded font-bold tabular-nums leading-none",
                      v.setChip,
                      Number(s[1]) > Number(s[0])
                        ? "bg-foreground text-background"
                        : "bg-background text-muted-foreground",
                    )}
                  >
                    {s[1]}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-2 flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-muted/30 px-2 py-1 text-[10px] font-medium text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>Marcador no disponible</span>
            </div>
          )}

          {m.partner_name && (
            <p className="mt-1.5 truncate text-[10px] text-muted-foreground">
              Pareja: <span className="font-medium text-foreground">{m.partner_name}</span>
            </p>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="mt-1.5 flex h-6 items-center justify-between border-t border-border/50 pt-1">
        <span
          className={cn(
            "inline-flex h-5 items-center gap-1 rounded-full px-1.5 text-[10px] font-bold leading-none",
            adjustment
              ? "bg-muted text-muted-foreground"
              : m.won
                ? "bg-success/15 text-success"
                : "bg-destructive/15 text-destructive",
          )}
        >
          {adjustment ? (
            <>
              <Sparkles className="h-2.5 w-2.5 shrink-0" strokeWidth={3} />
              <span>Ajuste</span>
            </>
          ) : (
            <>
              <Icon className="h-2.5 w-2.5 shrink-0" strokeWidth={3} />
              <span>{m.won ? "Ganado" : "Perdido"}</span>
            </>
          )}
        </span>
        <span
          className={cn(
            "inline-flex h-5 items-center font-display text-xs font-bold leading-none tabular-nums",
            getDeltaColor(Number(m.delta)),
          )}
        >
          {formatDelta(Number(m.delta))}
        </span>
      </div>
    </div>
  );
};

export const RecentMatchesCarousel = ({
  matches,
  meName,
  meAvatar,
  meLevel,
  basis = "basis-[88%] xs:basis-[78%] sm:basis-[48%] lg:basis-[32%]",
  compact = false,
}: Props) => {
  if (matches.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border bg-card/50 p-4 text-center text-xs text-muted-foreground">
        Aún sin partidos registrados.
      </p>
    );
  }

  return (
    <Carousel
      opts={{ align: "start", dragFree: true, containScroll: "trimSnaps" }}
      className={cn(
        "relative w-full md:pl-10 md:pr-10",
        // Cadena de altura completa cuando el carrusel está dentro de un flex column con flex-1 (Home).
        // [&>div]:h-full fuerza el wrapper interno con overflow-hidden que añade el componente Carousel base
        // a respetar la altura del contenedor padre, evitando "saltos" al cambiar de slide.
        "h-full [&>div]:h-full",
      )}
    >
      <CarouselContent className="-ml-2 h-full items-stretch">
        {matches.map((m) => (
          <CarouselItem key={m.id} className={cn("pl-2 h-auto", basis)}>
            <MatchCard m={m} meName={meName} meAvatar={meAvatar} meLevel={meLevel} compact={compact} />
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious className="hidden md:flex left-0 top-1/2 -translate-y-1/2 h-8 w-8 border-border bg-background/95 backdrop-blur shadow-md hover:bg-background z-10" />
      <CarouselNext className="hidden md:flex right-0 top-1/2 -translate-y-1/2 h-8 w-8 border-border bg-background/95 backdrop-blur shadow-md hover:bg-background z-10" />
    </Carousel>
  );
};
