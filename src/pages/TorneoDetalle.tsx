import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, BarChart3, BookOpen, CalendarRange, ChevronRight, Layers, Settings2, Share2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { AppShell } from "@/components/AppShell";
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
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTournamentDetailEnriched } from "@/hooks/useTournamentDetailEnriched";
import { useTournamentCobrand } from "@/hooks/useTournamentCobrand";
import { useCanManageSpace } from "@/hooks/useCanManageSpace";
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
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  // Atrás determinístico: vuelve al origen si vino en state, si no a Espacios
  // (la lista vieja de Torneos ya no existe).
  const backTo = (location.state as { from?: string } | null)?.from ?? "/espacios";

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
  const { canManage } = useCanManageSpace(tournament?.id);
  const { rules } = useTournamentRules(tournament?.id);

  // Torneos de roster (Fase A): los participantes viven en rr_participant, no en
  // inscripciones del motor. Contamos roster por categoría + corte (settings) para
  // que el hero y cada categoría muestren datos reales (no 0/0).
  const catIds = useMemo(() => categories.map((c) => c.id), [categories]);
  const { data: rosterAgg } = useQuery({
    queryKey: ["tourn-roster-agg", slug, catIds.join(",")],
    enabled: catIds.length > 0,
    queryFn: async () => {
      const [{ data: rp }, { data: sp }] = await Promise.all([
        supabase.from("rr_participant").select("category_id").in("category_id", catIds),
        supabase.from("space").select("id, settings").in("id", catIds),
      ]);
      const countByCat = new Map<string, number>();
      for (const r of (rp as { category_id: string }[] | null) ?? []) {
        countByCat.set(r.category_id, (countByCat.get(r.category_id) ?? 0) + 1);
      }
      let closesAt: string | null = null;
      for (const s of (sp as { settings: { closes_at?: string } | null }[] | null) ?? []) {
        if (s.settings?.closes_at) closesAt = s.settings.closes_at;
      }
      const total = [...countByCat.values()].reduce((a, b) => a + b, 0);
      return { countByCat, total, closesAt };
    },
  });
  const isRosterTourn = (rosterAgg?.total ?? 0) > 0;
  const heroEnrolled = isRosterTourn ? rosterAgg!.total : totalEnrolled;
  const heroCapacityLabel = isRosterTourn ? "—" : String(totalCapacity);
  const heroDays = isRosterTourn
    ? (rosterAgg?.closesAt ? Math.max(0, Math.ceil((new Date(rosterAgg.closesAt).getTime() - Date.now()) / 86_400_000)) : null)
    : daysToClose;
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
      <AppShell>
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
      </AppShell>
    );
  }

  if (!tournament) {
    return (
      <AppShell>
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-gradient-warm">
        <p className="text-sm text-muted-foreground">Torneo no encontrado</p>
        <Link to="/espacios" className="text-sm text-primary underline">
          Volver
        </Link>
      </div>
      </AppShell>
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
    <AppShell>
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
              onClick={() => navigate(backTo)}
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
            <div className="mt-4 flex items-center gap-3">
              {cobrand.logo_url && (
                <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-white/95 p-1">
                  <img src={cobrand.logo_url} alt="" aria-hidden className="h-full w-full object-contain" />
                </span>
              )}
              <div className="flex min-w-0 flex-col gap-1">
                <div className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.32em] text-white/85">
                  {cobrand.flag_country && <Flag countryCode={cobrand.flag_country} size={14} />}
                  <span className="truncate">
                    {cobrand.lockup_text ?? `ACEPLAY × ${cobrand.display_name.toUpperCase()}`}
                  </span>
                </div>
                {cobrand.eyebrow_text && (
                  <p className="font-display text-xs italic text-white/80">
                    {cobrand.eyebrow_text}
                  </p>
                )}
              </div>
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
              tournament.starts_at && tournament.ends_at
                ? formatDateRange(tournament.starts_at, tournament.ends_at)
                : null]
              .filter(Boolean)
              .join(" · ")}
          </p>

          <div className="mt-3.5 grid grid-cols-3 gap-2 border-y border-white/15 py-3">
            <Stat value={String(heroEnrolled)} label="Inscritos" />
            <Stat value={heroCapacityLabel} label="Cupos" />
            <Stat
              value={
                heroDays === null
                  ? "—"
                  : heroDays === 0
                  ? "Cerrado"
                  : `${heroDays}d`
              }
              label="Cierre"
              highlight={heroDays !== null && heroDays <= 7 && heroDays > 0}
            />
          </div>

          {!isClosed && (
            // GUARDA DE COLOR: el CTA de acción de AcePlay es NARANJA (#EC6E2E),
            // aunque el hero esté tintado con el color del club. El branding del
            // club no pisa los tokens de acción.
            <Button
              onClick={handlePrimaryCta}
              className="mt-3 w-full bg-action text-action-foreground shadow-clay hover:bg-action/90"
            >
              {isEnrolled ? "Ver mi categoría" : "Inscribirme"}
            </Button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-md space-y-4 px-5 pt-4">
        {/* Entrada del organizador (motor vivo). El jugador no ve esto. */}
        {canManage && (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-info/40 bg-info/5 p-3">
            <div className="flex items-center gap-2 text-xs text-info">
              <Settings2 className="h-4 w-4 shrink-0" />
              <span className="font-semibold">Eres el organizador</span>
              <span className="text-muted-foreground">· gestiona cada categoría</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate(`/torneos/${slug}/gestionar`)}
            >
              Gestionar torneo
            </Button>
          </div>
        )}
        {tournament.description && (
          <p className="text-sm text-muted-foreground">{tournament.description}</p>
        )}

        {howItWorksSteps.length > 0 && (
          <HowItWorks steps={howItWorksSteps} accentColor={cobrand?.primary_hex || undefined} />
        )}

        <Tabs
          value={searchParams.get("tab") ?? "categories"}
          onValueChange={(v) => setSearchParams({ tab: v })}
        >
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
                  const rosterN = rosterAgg?.countByCat.get(c.id) ?? 0;
                  const enrolled = rosterN > 0 ? rosterN : (enrolledByCat[c.id] ?? 0);
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
                            {DISCIPLINE_LABEL[c.discipline]} · {capacity > 0 ? `${enrolled}/${capacity} cupos` : `${enrolled} inscritos`}
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
    </AppShell>
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
