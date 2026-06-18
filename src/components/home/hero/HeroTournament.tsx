import { Link } from "react-router-dom";
import { Trophy, ArrowRight, Calendar, MapPin } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import type { ActiveTournamentInfo } from "@/hooks/useUserActiveTournament";

/**
 * Variante del Hero: el usuario está inscrito en un torneo activo.
 * Prioridad de contenido interno: próximo partido > partido por reportar > último resultado > esperando llave.
 */
export const HeroTournament = ({ info }: { info: ActiveTournamentInfo }) => {
  const { tournament, category, nextMatch, reportableMatch, lastResult, bracketPublished } = info;
  const statusLabel =
    tournament.status === "en_curso"
      ? "En curso"
      : tournament.status === "inscripciones_abiertas"
        ? "Inscrito"
        : "Próximo";

  const linkBase = `/torneos/${tournament.slug}/cat/${category.id}`;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--gold))]/95 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--gold-foreground,0_0%_10%))] backdrop-blur-md">
          <Trophy className="h-3 w-3" strokeWidth={2.6} />
          Tu torneo · {statusLabel}
        </div>
      </div>

      <div className="space-y-1.5 text-white">
        <h1 className="font-display text-3xl font-semibold leading-[1.05] tracking-tight md:text-4xl">
          {tournament.name}
        </h1>
        <p className="text-xs uppercase tracking-wider text-white/80">{category.name}</p>
      </div>

      <div className="rounded-2xl border border-white/20 bg-black/25 p-3 backdrop-blur-sm">
        {nextMatch ? (
          <>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-white/70">
              Próximo partido
            </p>
            <p className="mt-1 text-sm font-medium text-white">vs {nextMatch.rival_name}</p>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/85">
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {format(parseISO(nextMatch.scheduled_at), "EEE d MMM · HH:mm", { locale: es })}
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
            <p className="text-[10px] font-semibold uppercase tracking-wide text-white/70">
              Pendiente de reportar
            </p>
            <p className="mt-1 text-sm font-medium text-white">
              Tienes un partido jugado sin resultado.
            </p>
          </>
        ) : lastResult ? (
          <>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-white/70">
              Último partido
            </p>
            <p className="mt-1 text-sm font-medium text-white">
              {lastResult.won ? "Ganaste a" : "Perdiste con"} {lastResult.rival_name}
            </p>
          </>
        ) : bracketPublished ? (
          <>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-white/70">
              Cuadro publicado
            </p>
            <p className="mt-1 text-sm font-medium text-white">
              Estás inscrito, pero no fuiste sembrado en esta llave.
            </p>
          </>
        ) : (
          <p className="text-sm font-medium text-white">Inscrito · esperando llave</p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Link to={`${linkBase}?tab=llave`} className="w-fit">
          <Button variant="clay" size="lg" aria-label="Ver llave del torneo">
            Ver llave
            <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
          </Button>
        </Link>
        {reportableMatch && (
          <Link to={`${linkBase}?tab=mios`} className="w-fit">
            <Button
              size="lg"
              variant="outline"
              className="border-white/40 bg-white/10 text-white hover:bg-white/20"
            >
              Reportar resultado
            </Button>
          </Link>
        )}
      </div>
    </>
  );
};
