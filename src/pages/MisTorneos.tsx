import { Link } from "react-router-dom";
import { ArrowLeft, Trophy, Lock, CalendarDays, Users } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { useAuth } from "@/components/providers/AuthProvider";
import { AppShell } from "@/components/AppShell";
import { useOrganizerHistory, type OrganizerHistoryRow } from "@/hooks/useOrganizerHistory";
import { useOrganizerReputation } from "@/hooks/useOrganizerReputation";
import { OrganizerReputationCard } from "@/components/tournaments/OrganizerReputationCard";

const MisTorneos = () => {
  const { profile } = useAuth();
  const userId = profile?.user_id ?? null;
  const { data: history = [], isLoading } = useOrganizerHistory(userId);
  const { data: rep } = useOrganizerReputation(userId);

  const closed = history.filter((t) => t.closed_at !== null);
  const live = history.filter(
    (t) => t.closed_at === null && ["en_curso", "inscripciones_abiertas", "inscripciones_cerradas"].includes(t.status),
  );
  const drafts = history.filter((t) => t.closed_at === null && t.status === "borrador");

  return (
    <AppShell>
      <div className="min-h-screen bg-gradient-warm pb-12">
        <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-xl">
          <div className="mx-auto flex max-w-2xl items-center gap-3 px-5 py-4">
            <Link
              to="/perfil"
              className="flex h-9 w-9 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground hover:text-foreground"
              aria-label="Volver"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="font-display text-lg font-semibold">Mis torneos organizados</h1>
              <p className="text-xs text-muted-foreground">Historial y reputación</p>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-2xl space-y-6 px-5 pt-4">
          <OrganizerReputationCard rep={rep ?? null} />

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : history.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center">
              <Trophy className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-sm">Aún no organizas torneos.</p>
              <Link to="/admin/torneos" className="mt-3 inline-block text-sm text-primary underline">
                Ir a la consola de torneos
              </Link>
            </div>
          ) : (
            <>
              {live.length > 0 && <Section title="En curso" items={live} />}
              {drafts.length > 0 && <Section title="Borradores" items={drafts} />}
              {closed.length > 0 && <Section title="Finalizados" items={closed} />}
            </>
          )}
        </main>
      </div>
    </AppShell>
  );
};

const Section = ({ title, items }: { title: string; items: OrganizerHistoryRow[] }) => (
  <section>
    <h2 className="mb-3 text-[10px] uppercase tracking-[0.32em] text-muted-foreground">{title}</h2>
    <div className="space-y-2">
      {items.map((t) => (
        <TournamentRow key={t.tournament_id} t={t} />
      ))}
    </div>
  </section>
);

const TournamentRow = ({ t }: { t: OrganizerHistoryRow }) => {
  const champions = (t.closing_summary?.categories ?? [])
    .filter((c) => c.champion)
    .map((c) => c.name);

  return (
    <Link
      to={`/admin/torneos/${t.tournament_id}`}
      className="block rounded-2xl border border-border bg-card p-4 hover:border-primary/40"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-display text-sm font-semibold">{t.name}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {format(parseISO(t.starts_at), "d MMM yyyy", { locale: es })}
            {(t.sports?.length ?? 0) > 0 && ` · ${t.sports!.join(", ")}`}
          </p>
        </div>
        {t.closed_at && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">
            <Lock className="h-3 w-3" /> Cerrado
          </span>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Users className="h-3 w-3" /> {t.participants_count} inscritos
        </span>
        <span className="inline-flex items-center gap-1">
          <CalendarDays className="h-3 w-3" /> {t.matches_played} partidos
        </span>
      </div>
      {champions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {champions.map((c) => (
            <span
              key={c}
              className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-700"
            >
              <Trophy className="h-3 w-3" /> {c}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
};

export default MisTorneos;