import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Trophy, Search, Filter } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { BottomNav } from "@/components/BottomNav";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { EmptyState } from "@/components/EmptyState";
import { NotificationCenter } from "@/components/NotificationCenter";
import { SportBadge } from "@/components/SportBadge";
import { Input } from "@/components/ui/input";
import { TournamentCardSkeleton } from "@/components/tournaments/TournamentCardSkeleton";
import { TournamentCard } from "@/components/tournaments/TournamentCard";
import { ActiveTournamentHero } from "@/components/tournaments/ActiveTournamentHero";
import { PendingConfirmationsCard } from "@/components/home/PendingConfirmationsCard";
import { UserHistoryCollapsible } from "@/components/tournaments/UserHistoryCollapsible";
import { UpcomingEmptyAlertCard } from "@/components/tournaments/UpcomingEmptyAlertCard";
import { useMyOperatorTournaments } from "@/hooks/useMyOperatorTournaments";
import { Radio } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTournamentsList, type TournamentListItem } from "@/hooks/useTournamentsList";
import { useActiveSport } from "@/components/providers/SportProvider";

type DisciplineFilter = "todas" | "tenis_singles" | "tenis_dobles" | "padel_dobles";
type TabKey = "open" | "active" | "upcoming" | "finished";

const Torneos = () => {
  const { isAdmin } = useAuth();
  const { sport: activeSport } = useActiveSport();
  const { tournaments, loading, userHistory } = useTournamentsList();
  const { tournaments: operatorTournaments } = useMyOperatorTournaments();
  const [search, setSearch] = useState("");
  const [discipline, setDiscipline] = useState<DisciplineFilter>("todas");
  const [tab, setTab] = useState<TabKey>("open");

  const disciplineOptions = useMemo(
    () =>
      activeSport === "padel"
        ? ([
            { v: "todas", l: "Todas" },
            { v: "padel_dobles", l: "Dobles" },
          ] as const)
        : ([
            { v: "todas", l: "Todas" },
            { v: "tenis_singles", l: "Singles" },
            { v: "tenis_dobles", l: "Dobles" },
          ] as const),
    [activeSport],
  );

  // Reset filter cuando cambia el deporte activo
  useEffect(() => {
    setDiscipline("todas");
  }, [activeSport]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const sportDisciplines =
      activeSport === "padel"
        ? new Set(["padel_dobles"])
        : new Set(["tenis_singles", "tenis_dobles"]);
    return tournaments.filter((t) => {
      if (q && !t.name.toLowerCase().includes(q)) return false;
      const cats = t.tournament_categories ?? [];
      // Filtra por deporte activo
      if (!cats.some((c) => sportDisciplines.has(c.discipline))) return false;
      if (discipline !== "todas") {
        if (!cats.some((c) => c.discipline === discipline)) return false;
      }
      return true;
    });
  }, [tournaments, search, discipline, activeSport]);

  const grouped = useMemo(() => {
    const open: TournamentListItem[] = [];
    const upcoming: TournamentListItem[] = [];
    const active: TournamentListItem[] = [];
    const finished: TournamentListItem[] = [];
    for (const t of filtered) {
      if (t.status === "inscripciones_abiertas") open.push(t);
      else if (t.status === "inscripciones_cerradas" || t.status === "borrador") upcoming.push(t);
      else if (t.status === "en_curso") active.push(t);
      else if (t.status === "finalizado" || t.status === "cancelado") finished.push(t);
    }
    return { open, upcoming, active, finished };
  }, [filtered]);

  return (
    <div className="min-h-screen bg-gradient-warm pb-28">
      <header className="safe-top sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-md items-center gap-3 px-5 pb-3 pt-3">
          <Link
            to="/"
            className="flex h-9 w-9 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground hover:text-foreground"
            aria-label="Volver al inicio"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="flex-1 font-display text-xl font-semibold">Torneos</h1>
          <div className="flex items-center gap-1.5">
            <SportBadge />
            <NotificationCenter />
            {isAdmin && (
              <Link
                to="/admin/torneos"
                className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted"
              >
                Admin
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-md space-y-4 px-5 pt-4">
        <PendingConfirmationsCard />

        {operatorTournaments.length > 0 && (
          <div className="space-y-2">
            {operatorTournaments.map((t) => (
              <Link
                key={t.id}
                to={`/torneos/${t.slug}/operador`}
                className="group flex items-center gap-3 rounded-2xl border-2 border-primary/40 bg-gradient-to-br from-primary/10 to-primary/5 p-4 transition-smooth hover:border-primary/60"
              >
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/15 text-destructive">
                  <Radio className="h-4 w-4 motion-safe:animate-pulse" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-destructive">
                    Modo operador · Live
                  </p>
                  <p className="truncate font-display text-base font-semibold">{t.name}</p>
                </div>
                <span className="font-mono text-[10px] uppercase tracking-[0.32em] text-primary group-hover:translate-x-0.5 transition-smooth">
                  Entrar →
                </span>
              </Link>
            ))}
          </div>
        )}

        <ActiveTournamentHero
          openCount={grouped.open.length}
          onSeeOpen={() => setTab("open")}
        />

        <div className="space-y-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar torneo por nombre"
              className="h-10 rounded-2xl pl-9"
              aria-label="Buscar torneo"
            />
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <Filter className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            {disciplineOptions.map((opt) => (
              <button
                key={opt.v}
                type="button"
                onClick={() => setDiscipline(opt.v as DisciplineFilter)}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1 text-[11px] font-medium transition-smooth",
                  discipline === opt.v
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                {opt.l}
              </button>
            ))}
          </div>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="open" className="text-xs">
              Abiertos ({grouped.open.length})
            </TabsTrigger>
            <TabsTrigger value="active" className="text-xs">
              En curso ({grouped.active.length})
            </TabsTrigger>
            <TabsTrigger value="upcoming" className="text-xs">
              Próximos ({grouped.upcoming.length})
            </TabsTrigger>
            <TabsTrigger value="finished" className="text-xs">
              Pasados ({grouped.finished.length})
            </TabsTrigger>
          </TabsList>

          {(["open", "active", "upcoming", "finished"] as const).map((key) => (
            <TabsContent key={key} value={key} className="mt-4 space-y-3">
              {loading ? (
                <>
                  <TournamentCardSkeleton />
                  <TournamentCardSkeleton />
                  <TournamentCardSkeleton />
                </>
              ) : grouped[key].length === 0 ? (
                key === "upcoming" && !search && discipline === "todas" ? (
                  <UpcomingEmptyAlertCard />
                ) : key === "finished" && !search && discipline === "todas" ? (
                  <EmptyState
                    icon={Trophy}
                    title="Sin historial todavía"
                    description="Aún no has participado. Inscríbete a uno abierto para empezar tu historial."
                    action={{ label: "Ver abiertos", onClick: () => setTab("open") }}
                  />
                ) : (
                  <EmptyState
                    icon={Trophy}
                    title="Sin torneos"
                    description={
                      search || discipline !== "todas"
                        ? "Sin coincidencias para los filtros aplicados."
                        : key === "open"
                          ? "No hay inscripciones abiertas en este momento."
                          : "Ningún torneo en curso."
                    }
                  />
                )
              ) : (
                grouped[key].map((t) => <TournamentCard key={t.id} tournament={t} />)
              )}
            </TabsContent>
          ))}
        </Tabs>

        {!loading && <UserHistoryCollapsible history={userHistory} />}
      </main>

      <BottomNav />
    </div>
  );
};

export default Torneos;
