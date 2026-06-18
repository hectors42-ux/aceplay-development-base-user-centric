import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, BarChart3, BookOpen, CalendarRange, ChevronRight, Layers, Share2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { BottomNav } from "@/components/BottomNav";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TournamentScheduleView } from "@/components/tournaments/TournamentScheduleView";
import { ShareSheet } from "@/components/share/ShareSheet";
import {
  CATEGORY_COLOR_VARS,
  DISCIPLINE_LABEL,
  SURFACE_LABEL,
  TOURNAMENT_STATUS_LABEL,
  type TournamentStatus,
} from "@/lib/tournament-utils";
import { useTournamentDetailEnriched } from "@/hooks/useTournamentDetailEnriched";
import { useTournamentCobrand } from "@/hooks/useTournamentCobrand";
import { useTournamentRules } from "@/hooks/useTournamentRules";
import { parsePlayerSteps } from "@/lib/rules-markdown";
import { HowItWorks } from "@/components/tournaments/HowItWorks";
import { RulesView } from "@/components/tournaments/RulesView";
import { Flag } from "@/components/tournaments/cobrand/Flag";
import { cn } from "@/lib/utils";


const formatDateRange = (start: string, end: string) => {
  const s = parseISO(start);
  const e = parseISO(end);
  const sameMonth = s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
  if (sameMonth) {
    return `${format(s, "d", { locale: es })}–${format(e, "d MMM", { locale: es })}`;
  }
  return `${format(s, "d MMM", { locale: es })} – ${format(e, "d MMM", { locale: es })}`;
};

const TorneoDetalle = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  
  const {
    tournament,
    categories,
    enrolledByCat,
    totalEnrolled,
    totalCapacity,
    daysToClose,
    isEnrolled,
    myCategoryId,
    loading,
  } = useTournamentDetailEnriched(slug);
  const { cobrand } = useTournamentCobrand(tournament?.id);
  const { rules } = useTournamentRules(tournament?.id);
  const [shareOpen, setShareOpen] = useState(false);
  const howItWorksSteps = useMemo(
    () => parsePlayerSteps(rules?.player_guide_md).slice(0, 3),
    [rules?.player_guide_md],
  );

  const status = (tournament?.status ?? "borrador") as TournamentStatus;
  const isOpen = status === "inscripciones_abiertas";
  const isClosed = status === "inscripciones_cerradas" || status === "finalizado" || status === "cancelado";

  const surfaceLabel = useMemo(() => {
    if (categories.length === 0) return "";
    const uniq = Array.from(new Set(categories.map((c) => c.surface)));
    if (uniq.length === 1) return SURFACE_LABEL[uniq[0]];
    return "Varias superficies";
  }, [categories]);

  const disciplineLabel = useMemo(() => {
    if (categories.length === 0) return "";
    const uniq = Array.from(new Set(categories.map((c) => c.discipline)));
    if (uniq.length === 1) return DISCIPLINE_LABEL[uniq[0]];
    return "Varias modalidades";
  }, [categories]);

  const handleShare = () => {
    setShareOpen(true);
  };

  const handlePrimaryCta = () => {
    if (isEnrolled && myCategoryId) {
      navigate(`/torneos/${slug}/cat/${myCategoryId}`);
    } else if (isOpen && categories[0]) {
      navigate(`/torneos/${slug}/cat/${categories[0].id}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-warm pb-28">
        <div className="bg-gradient-clay-deep px-5 pb-10 pt-12">
          <Skeleton className="h-6 w-40 bg-white/20" />
          <Skeleton className="mt-4 h-9 w-64 bg-white/20" />
          <Skeleton className="mt-2 h-4 w-48 bg-white/20" />
        </div>
        <main className="mx-auto max-w-md space-y-3 px-5 pt-4">
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
        </main>
        <BottomNav />
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-gradient-warm">
        <p className="text-sm text-muted-foreground">Torneo no encontrado</p>
        <Link to="/torneos" className="text-sm text-primary underline">
          Volver
        </Link>
      </div>
    );
  }

  // Title con énfasis: última palabra italic + gold
  const renderTitle = () => {
    const parts = tournament.name.trim().split(" ");
    if (parts.length === 1) {
      return <span className="italic text-gold">{parts[0]}</span>;
    }
    const last = parts.pop()!;
    return (
      <>
        {parts.join(" ")} <em className="not-italic font-normal italic text-gold">{last}</em>
      </>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-warm pb-28">
      {/* HERO */}
      <header
        className={cn(
          "relative overflow-hidden text-white",
          !cobrand && "bg-gradient-clay-deep",
        )}
        style={
          cobrand
            ? { background: cobrand.gradient_css || cobrand.primary_hex || undefined }
            : undefined
        }
      >
        <div className="pointer-events-none absolute -right-8 -top-10 h-44 w-44 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-5 -left-3 h-24 w-24 rounded-full bg-white/5" />
        <div className="relative mx-auto max-w-md px-5 pb-6 pt-5">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => navigate("/torneos")}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 backdrop-blur-md transition hover:bg-white/20"
              aria-label="Volver"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleShare}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 backdrop-blur-md transition hover:bg-white/20"
              aria-label="Compartir"
            >
              <Share2 className="h-4 w-4" />
            </button>
          </div>

          {cobrand && (
            <div className="mt-4 flex flex-col gap-1">
              <div className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.32em] text-white/85">
                <Flag countryCode={cobrand.flag_country} size={14} />
                <span>
                  {cobrand.lockup_text ?? `ACEPLAY × ${cobrand.display_name.toUpperCase()}`}
                </span>
              </div>
              {cobrand.eyebrow_text && (
                <p className="font-display text-xs italic text-white/80">
                  {cobrand.eyebrow_text}
                </p>
              )}
            </div>
          )}

          <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-medium uppercase tracking-wider backdrop-blur-md">
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                isOpen ? "bg-gold animate-pulse" : "bg-white/50",
              )}
            />
            {TOURNAMENT_STATUS_LABEL[status]}
          </div>

          <h1 className="mt-3 font-display text-[32px] font-semibold leading-[1.05]">
            {renderTitle()}
          </h1>

          <p className="mt-1.5 text-[12px] opacity-85">
            {[disciplineLabel, `${categories.length} categorías`, surfaceLabel,
              formatDateRange(tournament.starts_at, tournament.ends_at)]
              .filter(Boolean)
              .join(" · ")}
          </p>

          <div className="mt-3.5 grid grid-cols-3 gap-2 border-y border-white/15 py-3">
            <Stat value={String(totalEnrolled)} label="Inscritos" />
            <Stat value={String(totalCapacity)} label="Cupos" />
            <Stat
              value={
                daysToClose === null
                  ? "—"
                  : daysToClose === 0
                  ? "Cerrado"
                  : `${daysToClose}d`
              }
              label="Cierre"
              highlight={daysToClose !== null && daysToClose <= 7 && daysToClose > 0}
            />
          </div>

          {!isClosed && (
            <Button
              onClick={handlePrimaryCta}
              className="mt-3 w-full bg-white text-clay-deep hover:bg-white/90"
            >
              {isEnrolled ? "Ver mi categoría" : "Inscribirme"}
            </Button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-md space-y-4 px-5 pt-4">
        {tournament.description && (
          <p className="text-sm text-muted-foreground">{tournament.description}</p>
        )}

        {howItWorksSteps.length > 0 && (
          <HowItWorks steps={howItWorksSteps} accentColor={cobrand?.primary_hex || undefined} />
        )}

        <Tabs defaultValue="categories">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="categories" className="text-xs">
              <Layers className="mr-1 h-3.5 w-3.5" /> Categorías
            </TabsTrigger>
            <TabsTrigger value="calendar" className="text-xs">
              <CalendarRange className="mr-1 h-3.5 w-3.5" /> Calendario
            </TabsTrigger>
            <TabsTrigger value="stats" className="text-xs">
              <BarChart3 className="mr-1 h-3.5 w-3.5" /> Stats
            </TabsTrigger>
            <TabsTrigger value="rules" className="text-xs">
              <BookOpen className="mr-1 h-3.5 w-3.5" /> Reglas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="categories" className="mt-4">
            {categories.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border bg-card/50 p-6 text-center text-sm text-muted-foreground">
                Aún no hay categorías abiertas.
              </p>
            ) : (
              <div className="space-y-2">
                {categories.map((c, idx) => {
                  const color = CATEGORY_COLOR_VARS[idx % CATEGORY_COLOR_VARS.length];
                  const enrolled = enrolledByCat[c.id] ?? 0;
                  const capacity = c.max_participants ?? 0;
                  const pct = capacity > 0 ? Math.min(100, (enrolled / capacity) * 100) : 0;
                  return (
                    <Link
                      key={c.id}
                      to={`/torneos/${tournament.slug}/cat/${c.id}`}
                      className="group flex items-stretch overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-smooth hover:-translate-y-0.5"
                    >
                      <div className="w-1.5 shrink-0" style={{ background: color }} />
                      <div className="flex flex-1 items-center gap-3 px-4 py-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-semibold">{c.name}</p>
                            <span
                              className="shrink-0 rounded-full border px-1.5 py-px text-[10px] font-medium"
                              style={{ borderColor: color, color }}
                            >
                              {c.category_label}
                            </span>
                          </div>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {DISCIPLINE_LABEL[c.discipline]} · {enrolled}/{capacity} cupos
                          </p>
                          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${pct}%`, background: color }}
                            />
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="calendar" className="mt-4">
            <TournamentScheduleView tournamentId={tournament.id} />
          </TabsContent>

          <TabsContent value="stats" className="mt-4">
            <div className="space-y-3">
              <div className="rounded-2xl border border-border bg-card p-4">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Inscripciones</p>
                <p className="mt-1 font-display text-2xl font-semibold">
                  {totalEnrolled}
                  <span className="text-base font-normal text-muted-foreground">/{totalCapacity}</span>
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                Estadísticas detalladas por categoría en cada subtorneo.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="rules" className="mt-4">
            <RulesView tournamentId={tournament.id} tournamentName={tournament.name} />
          </TabsContent>
        </Tabs>
      </main>

      <BottomNav />

      <ShareSheet
        open={shareOpen}
        onOpenChange={setShareOpen}
        tournamentId={tournament.id}
        tournamentName={tournament.name}
        slug={tournament.slug}
      />
    </div>
  );
};

const Stat = ({ value, label, highlight }: { value: string; label: string; highlight?: boolean }) => (
  <div className="text-center">
    <p
      className={cn(
        "font-display text-xl font-semibold leading-none",
        highlight && "text-gold",
      )}
    >
      {value}
    </p>
    <p className="mt-1 text-[10px] uppercase tracking-wider opacity-75">{label}</p>
  </div>
);

export default TorneoDetalle;
