import { Link } from "react-router-dom";
import { Calendar, MapPin, Trophy, ArrowRight, Sparkles } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useUserActiveTournament } from "@/hooks/useUserActiveTournament";
import { useTournamentCobrand } from "@/hooks/useTournamentCobrand";
import { CobrandBadge } from "@/components/tournaments/cobrand/CobrandBadge";

export function ActiveTournamentHero({
  openCount,
  onSeeOpen,
}: {
  openCount: number;
  onSeeOpen: () => void;
}) {
  const { data, loading } = useUserActiveTournament();
  const { cobrand } = useTournamentCobrand(data?.tournament.id);

  if (loading) return <Skeleton className="h-40 w-full rounded-3xl" />;

  if (!data) {
    return (
      <div className="rounded-3xl border border-dashed border-border bg-card/50 p-5 text-center">
        <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Sparkles className="h-5 w-5" />
        </div>
        <h2 className="font-display text-base font-semibold">Aún no estás inscrito</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {openCount > 0
            ? `Hay ${openCount} torneo${openCount === 1 ? "" : "s"} abierto${openCount === 1 ? "" : "s"} esta temporada.`
            : "No hay torneos abiertos por ahora. Te avisaremos."}
        </p>
        {openCount > 0 && (
          <Button size="sm" className="mt-3" onClick={onSeeOpen}>
            Ver torneos abiertos
          </Button>
        )}
      </div>
    );
  }

  const { tournament, category, nextMatch, reportableMatch, lastResult, bracketPublished } = data;
  const statusLabel =
    tournament.status === "en_curso"
      ? "En curso"
      : tournament.status === "inscripciones_abiertas"
        ? "Inscrito"
        : "Próximo";

  return (
    <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/15 via-primary/5 to-card p-5 shadow-card">
      <div className="mb-2 flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[hsl(var(--gold))] opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[hsl(var(--gold))]" />
          </span>
          {statusLabel}
        </span>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Tu torneo activo
        </span>
        {cobrand && <CobrandBadge cobrand={cobrand} variant="pill" className="ml-auto" />}
      </div>

      <h2 className="font-display text-xl font-semibold leading-tight italic">
        {tournament.name}
      </h2>
      <p className="text-xs text-muted-foreground">{category.name}</p>

      <div className="mt-3 rounded-2xl border border-border/60 bg-background/60 p-3" data-testid="hero-state">
        {nextMatch ? (
          <>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Próximo partido
            </p>
            <p className="mt-1 text-sm font-medium">vs {nextMatch.rival_name}</p>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {format(parseISO(nextMatch.scheduled_at), "EEE d MMM · HH:mm", {
                  locale: es,
                })}
              </span>
              {nextMatch.court_name && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {nextMatch.court_name}
                </span>
              )}
            </div>
          </>
        ) : reportableMatch ? (
          <>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Pendiente de reportar
            </p>
            <p className="mt-1 text-sm font-medium">Tienes un partido jugado sin resultado</p>
          </>
        ) : lastResult ? (
          <>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Último partido
            </p>
            <p className="mt-1 text-sm font-medium">
              {lastResult.won ? "Ganaste a" : "Perdiste con"} {lastResult.rival_name}
            </p>
          </>
        ) : bracketPublished ? (
          <>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              No quedaste en el cuadro
            </p>
            <p className="mt-1 text-sm font-medium">Estás inscrito, pero no fuiste sembrado en esta llave.</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Contacta al administrador del torneo si crees que es un error.
            </p>
          </>
        ) : (
          <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Trophy className="h-3.5 w-3.5" />
            Esperando llave
          </p>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Button asChild size="lg" className="flex-1">
          <Link to={`/torneos/${tournament.slug}/cat/${category.id}?tab=llave`}>
            Ver llave
            <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
        {reportableMatch && (
          <Button asChild size="lg" variant="outline" className="flex-1">
            <Link to={`/torneos/${tournament.slug}/cat/${category.id}?tab=mios`}>
              Reportar resultado
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
