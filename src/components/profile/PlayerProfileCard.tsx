import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Swords,
  Phone,
  Mail,
  Hand,
  Activity,
  MapPin,
  Calendar as CalendarIcon,
  Clock,
  History,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useUserProfileSummary } from "@/hooks/useUserProfileSummary";
import { useClubRanking, type RankingSport } from "@/hooks/useClubRanking";
import { useMatchHistory } from "@/hooks/useMatchHistory";
import { useActiveSport } from "@/components/providers/SportProvider";
import { RecentMatchesCarousel } from "@/components/ranking/RecentMatchesCarousel";
import { LevelHeroCard } from "@/components/rating/LevelHeroCard";
import { AvatarViewer } from "./AvatarViewer";
import { StatRing } from "./StatRing";
import { Last10StreakRing } from "./Last10StreakRing";
import { MatchHistorySheet } from "./MatchHistorySheet";
import { MatchesPendingResultCard } from "./MatchesPendingResultCard";
import { EvolutionSheet } from "./EvolutionSheet";
import { type RatingSport } from "@/lib/rating-utils";
import { cn } from "@/lib/utils";

interface Props {
  userId: string;
  mode: "own" | "public";
  sport?: RatingSport;
  onChallenge?: () => void;
  showChallengeButton?: boolean;
}

const initials = (first: string, last: string) =>
  `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase() || "?";

const HAND_LABEL: Record<string, string> = { right: "Diestro", left: "Zurdo", ambi: "Ambidiestro" };
const BACKHAND_LABEL: Record<string, string> = { one_handed: "Revés a 1 mano", two_handed: "Revés a 2 manos" };
const SURFACE_LABEL: Record<string, string> = {
  arcilla: "Arcilla",
  cesped: "Césped",
  dura: "Dura",
  sintetico: "Sintética",
};

const CAT_STYLE: Record<string, string> = {
  A: "bg-success/15 text-success",
  B: "bg-primary/15 text-primary",
  C: "bg-accent/20 text-accent-foreground",
};

/** Fuentes que NO son partidos contra otro socio (mismo set que en RecentMatchesCarousel). */
const NON_VERSUS_SOURCES = new Set([
  "clase",
  "onboarding",
  "manual_admin",
  "manual_self",
  "decay",
]);

/** Fuentes que SÍ cuentan como partido versus para "Últimos 10". Si la fuente
 * está dentro de los versus pero no tenemos opponent_name resuelto (datos
 * históricos sin source_ref_id), aún así contabilizamos el resultado en el
 * anillo W/L — solo evitamos pintarlo en el carrusel de "Recientes". */
const VERSUS_SOURCES_FOR_STREAK = new Set([
  "ladder_challenge",
  "tournament_match",
  "open_match",
  "ten_match_challenge",
]);

const Chip = ({ icon: Icon, label }: { icon: typeof Hand; label: string }) => (
  <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-foreground">
    <Icon className="h-3 w-3 text-muted-foreground" strokeWidth={2.2} />
    {label}
  </span>
);

export const PlayerProfileCard = ({
  userId,
  mode,
  sport: initialSportProp,
  onChallenge,
  showChallengeButton,
}: Props) => {
  const { ratingSport: activeRatingSport } = useActiveSport();
  const initialSport: RatingSport = initialSportProp ?? activeRatingSport;
  const [sport, setSport] = useState<RatingSport>(initialSport);
  // Si el toggle global cambia y el caller no fijó un deporte explícito,
  // sincronizamos el estado local para que perfil/ranking/escalerilla
  // reflejen el deporte activo.
  useEffect(() => {
    if (!initialSportProp) setSport(activeRatingSport);
  }, [activeRatingSport, initialSportProp]);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<"all" | "pending">("all");
  const [evolutionOpen, setEvolutionOpen] = useState(false);
  const { data, loading } = useUserProfileSummary(userId, sport);
  const { rows: ranking } = useClubRanking(sport as RankingSport);
  // Solo cargamos pendientes cuando es perfil propio. El sheet hace su propio fetch.
  const { data: ownHistory } = useMatchHistory(userId, { enabled: mode === "own", limit: 50 });
  const myRanking = useMemo(
    () => ranking.find((r) => r.user_id === userId) ?? null,
    [ranking, userId],
  );
  const pendingCount =
    (ownHistory?.pending_tournaments?.length ?? 0) + (ownHistory?.pending_ladder?.length ?? 0);

  const openHistory = (f: "all" | "pending") => {
    setHistoryFilter(f);
    setHistoryOpen(true);
  };

  // Hooks must run before any early return
  // Últimos 10 resultados con contrincante real (mismo criterio que RecentMatchesCarousel:
  // descarta fuentes sin oponente Y entradas sin opponent_name aunque la fuente sea versus).
  const last10Results = useMemo<boolean[]>(() => {
    if (!data) return [];
    // Para el anillo W/L solo importa si fue partido versus, no si tenemos el
    // nombre del rival resuelto. Datos seed sin source_ref_id igual deben
    // contar como victoria/derrota.
    const versus = data.recent_matches.filter((m) =>
      VERSUS_SOURCES_FOR_STREAK.has(m.source),
    );
    // recent_matches viene del más reciente al más antiguo. Tomamos los 10 más recientes
    // y los invertimos para mostrarlos del más antiguo al más reciente en el anillo.
    return versus.slice(0, 10).reverse().map((m) => m.won);
  }, [data]);

  if (loading && !data) {
    return (
      <div className="space-y-3">
        {/* Header: avatar + nombre */}
        <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-elevated">
          <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-4">
            <div className="flex items-start gap-3">
              <Skeleton className="h-16 w-16 rounded-full" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <Skeleton className="h-12 w-10 rounded-2xl" />
            </div>
          </div>
          <div className="flex gap-1 border-t border-border p-1">
            <Skeleton className="h-7 flex-1 rounded-xl" />
            <Skeleton className="h-7 flex-1 rounded-xl" />
          </div>
        </div>

        {/* Hero "Tu nivel actual" */}
        <div className="rounded-3xl border border-border bg-gradient-to-br from-primary/10 via-card to-card p-4">
          <div className="flex items-end justify-between gap-3">
            <div className="space-y-2">
              <Skeleton className="h-2.5 w-24" />
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Skeleton className="h-[68px] rounded-2xl" />
            <Skeleton className="h-[68px] rounded-2xl" />
          </div>
        </div>

        {/* Estadísticas con anillos */}
        <div className="rounded-3xl border border-border bg-card p-4">
          <Skeleton className="mb-3 h-2.5 w-24" />
          <div className="grid grid-cols-3 gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex flex-col items-center gap-1.5">
                <Skeleton className="h-[72px] w-[72px] rounded-full" />
                <Skeleton className="h-2.5 w-14" />
                <Skeleton className="h-2.5 w-12" />
              </div>
            ))}
          </div>
        </div>

        {/* Carrusel últimos partidos */}
        <div>
          <Skeleton className="mb-1.5 ml-1 h-2.5 w-28" />
          <div className="flex gap-2 overflow-hidden">
            <Skeleton className="h-[120px] w-[72%] shrink-0 rounded-2xl" />
            <Skeleton className="h-[120px] w-[72%] shrink-0 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/50 p-6 text-center text-xs text-muted-foreground">
        No se pudo cargar el perfil.
      </div>
    );
  }

  const { profile, rating, stats, recent_matches, flags } = data;
  const total = stats.wins + stats.losses;
  const winRate = total > 0 ? Math.round((stats.wins / total) * 100) : 0;
  const cat = rating?.category ?? null;
  const fullName = `${profile.first_name} ${profile.last_name}`.trim();
  const memberYear = profile.member_since ? new Date(profile.member_since).getFullYear() : null;

  // streak con signo: positivo = victorias, negativo = derrotas
  const signedStreak =
    stats.streak_kind === "desafio_ganado"
      ? stats.streak
      : stats.streak_kind === "desafio_perdido"
        ? -stats.streak
        : 0;

  const hasGameInfo =
    profile.dominant_hand ||
    profile.backhand ||
    profile.favorite_shot ||
    profile.favorite_surface ||
    profile.playing_style ||
    profile.years_playing;

  return (
    <div className="space-y-3">
      {/* Header: avatar + nombre */}
      <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-elevated">
        <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-4">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={() => setAvatarOpen(true)}
              className="rounded-full transition-smooth hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`Ver foto de ${fullName}`}
            >
              <Avatar className="h-16 w-16 ring-2 ring-background">
                <AvatarImage src={profile.avatar_url ?? undefined} />
                <AvatarFallback className="text-base font-semibold">
                  {initials(profile.first_name, profile.last_name)}
                </AvatarFallback>
              </Avatar>
            </button>
            <div className="min-w-0 flex-1">
              <h3 className="truncate font-display text-lg font-semibold leading-tight">
                {fullName}
                {flags.is_owner && (
                  <span className="ml-2 align-middle text-[9px] font-bold uppercase tracking-wider text-primary">
                    Tú
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-muted-foreground">
                {memberYear ? `Socio desde ${memberYear}` : "Socio del club"}
              </p>
              {profile.bio && (
                <p className="mt-1.5 line-clamp-2 text-[12px] italic text-muted-foreground">
                  "{profile.bio}"
                </p>
              )}
            </div>
            {cat && (
              <div className={cn("flex flex-col items-center rounded-2xl px-2.5 py-1.5", CAT_STYLE[cat])}>
                <span className="font-display text-lg font-bold leading-none">{cat}</span>
                <span className="text-[8px] font-semibold uppercase tracking-wider opacity-80">Cat.</span>
              </div>
            )}
          </div>
        </div>

        {/* Sport toggle: pádel solo tiene una variante; tenis ofrece singles/dobles */}
        <div className="flex gap-1 border-t border-border p-1">
          {(activeRatingSport === "padel"
            ? (["padel"] as RatingSport[])
            : (["tenis_singles", "tenis_dobles"] as RatingSport[])
          ).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSport(s)}
              className={cn(
                "flex-1 rounded-xl px-3 py-1.5 text-[11px] font-medium transition-smooth",
                sport === s
                  ? "bg-primary text-primary-foreground shadow-clay"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {s === "tenis_singles" ? "Singles" : s === "tenis_dobles" ? "Dobles" : "Pádel"}
            </button>
          ))}
        </div>
      </div>

      {/* === Stats block === (definido antes para poder reordenar entre own/public) */}
      {(() => {
        const heroBlock = (
          <div key="hero">
            <LevelHeroCard
              level={rating?.level ?? null}
              category={cat}
              delta={rating?.last_change_delta ?? 0}
              sport={sport}
              rankingPosition={myRanking?.rank_position ?? null}
              ladderPosition={data.positions.ladder ?? null}
              ladderStatus={data.positions.ladder_status ?? null}
              streak={signedStreak}
              reliability={rating?.reliability}
              matchesPlayed={rating?.matches_played}
              variant="full"
              title={mode === "own" ? "Tu nivel" : "Nivel"}
              onSeeMore={flags.is_owner ? () => setEvolutionOpen(true) : undefined}
            />
          </div>
        );

        const statsBlock = (
          <div key="stats" className="rounded-3xl border border-border bg-card p-4">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Estadísticas
            </p>
            <div className="grid grid-cols-3 gap-2">
              {/* % Ganados */}
              <div className="flex flex-col items-center gap-1.5 text-center">
                <StatRing
                  percent={total > 0 ? winRate : 0}
                  centerLabel={total > 0 ? `${winRate}%` : "—"}
                  tone="success"
                  ariaLabel={
                    total > 0
                      ? `${winRate}% de partidos ganados: ${stats.wins} ${
                          stats.wins === 1 ? "victoria" : "victorias"
                        } y ${stats.losses} ${stats.losses === 1 ? "derrota" : "derrotas"}`
                      : "Sin partidos para calcular porcentaje de victorias"
                  }
                />
                <p className="text-[10px] font-semibold uppercase tracking-wide text-foreground">
                  Ganados
                </p>
                <p className="text-[10px] tabular-nums text-muted-foreground">
                  {stats.wins}V · {stats.losses}D
                </p>
              </div>

              {/* Partidos jugados — solo número, sin umbral */}
              <div className="flex flex-col items-center gap-1.5 text-center">
                <div
                  className="relative inline-flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full bg-primary/10"
                  role="img"
                  aria-label={`${rating?.matches_played ?? 0} ${
                    (rating?.matches_played ?? 0) === 1 ? "partido jugado" : "partidos jugados"
                  } en total`}
                >
                  <span className="font-display text-xl font-bold tabular-nums leading-none text-foreground">
                    {rating?.matches_played ?? 0}
                  </span>
                </div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-foreground">
                  Partidos
                </p>
                <p className="text-[10px] text-muted-foreground">jugados</p>
              </div>

              {/* Racha últimos 10 */}
              <div className="flex flex-col items-center gap-1.5 text-center">
                <Last10StreakRing results={last10Results} />
                <p className="text-[10px] font-semibold uppercase tracking-wide text-foreground">
                  Últimos 10
                </p>
                <p className="text-[10px] tabular-nums text-muted-foreground">
                  {last10Results.length === 0
                    ? "sin partidos"
                    : `${last10Results.filter(Boolean).length}V · ${last10Results.filter((r) => !r).length}D`}
                </p>
              </div>
            </div>

            {/* Footer con accesos al historial — solo perfil propio */}
            {mode === "own" && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-1.5 border-t border-border/60 pt-2.5">
                <button
                  type="button"
                  onClick={() => openHistory("all")}
                  className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium text-primary transition-smooth hover:bg-primary/10"
                  aria-label="Ver historial completo de partidos"
                >
                  <History className="h-3 w-3" />
                  Historial completo
                </button>
                <button
                  type="button"
                  onClick={() => openHistory("pending")}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium transition-smooth",
                    pendingCount > 0
                      ? "text-warning hover:bg-warning/10"
                      : "text-muted-foreground hover:bg-muted",
                  )}
                  aria-label={
                    pendingCount > 0
                      ? `Gestionar ${pendingCount} partidos pendientes`
                      : "Gestionar partidos pendientes"
                  }
                >
                  <Clock className="h-3 w-3" />
                  Gestionar pendientes
                  {pendingCount > 0 && (
                    <span className="ml-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-warning/20 px-1 text-[9px] font-bold tabular-nums text-warning">
                      {pendingCount}
                    </span>
                  )}
                </button>
              </div>
            )}
          </div>
        );

        // En perfil propio: stats arriba, luego nivel.
        // En perfil público: nivel arriba (decisión de desafío), luego stats.
        return mode === "own" ? [statsBlock, heroBlock] : [heroBlock, statsBlock];
      })()}

      {/* Game style chips */}
      {hasGameInfo && (
        <div>
          <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Sobre su juego
          </p>
          <div className="flex flex-wrap gap-1.5">
            {profile.dominant_hand && <Chip icon={Hand} label={HAND_LABEL[profile.dominant_hand]} />}
            {profile.backhand && <Chip icon={Hand} label={BACKHAND_LABEL[profile.backhand]} />}
            {profile.favorite_shot && <Chip icon={Activity} label={profile.favorite_shot} />}
            {profile.favorite_surface && (
              <Chip icon={MapPin} label={SURFACE_LABEL[profile.favorite_surface] ?? profile.favorite_surface} />
            )}
            {profile.playing_style && <Chip icon={Activity} label={profile.playing_style} />}
            {profile.years_playing !== null && profile.years_playing !== undefined && (
              <Chip icon={CalendarIcon} label={`${profile.years_playing} años`} />
            )}
            {profile.availability && <Chip icon={CalendarIcon} label={profile.availability} />}
          </div>
        </div>
      )}

      {/* Recent matches */}
      <div>
        <div className="mb-1.5 flex items-center justify-between px-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Últimos partidos
          </p>
          {recent_matches.length > 0 && (
            <button
              type="button"
              onClick={() => setHistoryOpen(true)}
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium text-primary transition-smooth hover:bg-primary/10"
            >
              <History className="h-3 w-3" />
              Ver {mode === "own" ? "historial" : "más"}
            </button>
          )}
        </div>
        <RecentMatchesCarousel
          matches={recent_matches.slice(0, 8)}
          meName={fullName}
          meAvatar={profile.avatar_url}
          meLevel={rating?.level ?? null}
          basis="basis-[88%] xs:basis-[78%] sm:basis-[48%] lg:basis-[32%]"
        />
      </div>

      {/* Pendientes de tu acción — solo perfil propio */}
      {mode === "own" && ownHistory && (
        <MatchesPendingResultCard
          userId={userId}
          pendingTournaments={ownHistory.pending_tournaments}
          pendingLadder={ownHistory.pending_ladder}
        />
      )}

      {/* Contact (only public mode + opt-in) */}
      {mode === "public" && !flags.is_owner && (profile.email || profile.phone) && (
        <div className="rounded-2xl border border-border bg-card p-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Contacto
          </p>
          <div className="flex flex-wrap gap-2">
            {profile.phone && (
              <a
                href={`https://wa.me/${profile.phone.replace(/\D/g, "")}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted"
              >
                <Phone className="h-3 w-3" /> WhatsApp
              </a>
            )}
            {profile.email && (
              <a
                href={`mailto:${profile.email}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted"
              >
                <Mail className="h-3 w-3" /> Email
              </a>
            )}
          </div>
        </div>
      )}

      {/* Challenge action */}
      {mode === "public" && showChallengeButton && onChallenge && !flags.is_owner && (
        <Button variant="clay" className="w-full" onClick={onChallenge}>
          <Swords className="h-4 w-4" /> Desafiar en Pirámide
        </Button>
      )}

      <AvatarViewer
        open={avatarOpen}
        onOpenChange={setAvatarOpen}
        url={profile.avatar_url}
        name={fullName}
        initials={initials(profile.first_name, profile.last_name)}
      />

      <MatchHistorySheet
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        userId={userId}
        mode={mode}
        ownerName={mode === "public" ? fullName : undefined}
        initialFilter={historyFilter}
      />

      {flags.is_owner && (
        <EvolutionSheet
          open={evolutionOpen}
          onOpenChange={setEvolutionOpen}
          sport={sport === "padel" ? "padel" : sport === "tenis_dobles" ? "tenis_dobles" : "tenis_singles"}
        />
      )}
    </div>
  );
};
