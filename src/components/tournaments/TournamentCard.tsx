import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { format, parseISO, differenceInCalendarDays } from "date-fns";
import { es } from "date-fns/locale";
import { Progress } from "@/components/ui/progress";
import { CountdownBadge } from "./CountdownBadge";
import { AvatarStack } from "./AvatarStack";
import { CobrandBadge } from "./cobrand/CobrandBadge";
import type { TournamentListItem } from "@/hooks/useTournamentsList";
import { DISCIPLINE_LABEL } from "@/lib/tournament-utils";

export function TournamentCard({ tournament: t }: { tournament: TournamentListItem }) {
  const cats = t.tournament_categories ?? [];
  const cobrand = Array.isArray(t.tournament_cobrand)
    ? (t.tournament_cobrand[0] ?? null)
    : (t.tournament_cobrand ?? null);
  const disciplineLabel = cats[0]
    ? DISCIPLINE_LABEL[cats[0].discipline]
    : "Tenis";
  // El motor puede no exponer la fecha de cierre → ocultamos el countdown si falta.
  const days = t.registration_closes_at
    ? differenceInCalendarDays(parseISO(t.registration_closes_at), new Date())
    : null;
  const isOpen = t.status === "inscripciones_abiertas";
  const pct =
    t.capacity > 0 ? Math.min(100, Math.round((t.enrolled_count / t.capacity) * 100)) : 0;

  return (
    <Link
      to={`/torneos/${t.slug}`}
      className="group block rounded-3xl border border-border bg-card p-4 shadow-card transition-smooth hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {cobrand && (
            <div className="mb-1.5">
              <CobrandBadge cobrand={cobrand} variant="pill" />
            </div>
          )}
          <h3 className="font-display text-base font-semibold leading-tight">
            {t.name}
          </h3>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {disciplineLabel} · {cats.length} {cats.length === 1 ? "categoría" : "categorías"}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {isOpen && days != null && <CountdownBadge days={days} />}
          {t.user_registration && (
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
              Inscrito
            </span>
          )}
          {!t.user_registration && t.user_past_result && (
            <span className="rounded-full bg-[hsl(var(--gold))]/15 px-2 py-0.5 text-[10px] font-semibold text-[hsl(var(--gold))]">
              {t.user_past_result}
            </span>
          )}
        </div>
      </div>

      {t.capacity > 0 && (
        <div className="mb-3">
          <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>
              <span className="font-semibold text-foreground">{t.enrolled_count}</span> de{" "}
              {t.capacity} inscritos
            </span>
            <span>
              {Math.max(0, t.capacity - t.enrolled_count)} cupo
              {t.capacity - t.enrolled_count === 1 ? "" : "s"}
            </span>
          </div>
          <Progress value={pct} className="h-1.5" />
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        {t.recent_enrolled.length > 0 ? (
          <AvatarStack users={t.recent_enrolled} total={t.enrolled_count} />
        ) : (
          <span className="text-[11px] text-muted-foreground">Sin inscritos aún</span>
        )}
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          {t.starts_at && t.ends_at && (
            <span>
              {format(parseISO(t.starts_at), "d MMM", { locale: es })} –{" "}
              {format(parseISO(t.ends_at), "d MMM", { locale: es })}
            </span>
          )}
          <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </div>
      </div>
    </Link>
  );
}
