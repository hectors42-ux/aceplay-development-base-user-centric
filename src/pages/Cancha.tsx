import { Link, useSearchParams } from "react-router-dom";
import { Swords, Trophy, ChevronRight, Calendar, Mail, MapPin, Zap, Megaphone } from "lucide-react";
import { CoinHud } from "@/components/home/CoinHud";
import { SportSwitcher } from "@/components/SportSwitcher";
import { BottomNav } from "@/components/BottomNav";
import { AppFooter } from "@/components/AppFooter";
import { ArenaHero } from "@/components/arena";
import { EconomyStrip } from "@/components/home/EconomyStrip";
import { AscensionPathCard } from "@/components/cancha/AscensionPathCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/avatar/UserAvatar";
import { useAuth } from "@/components/providers/AuthProvider";
import { useActiveSport } from "@/components/providers/SportProvider";
import { useUserProfileSummary } from "@/hooks/useUserProfileSummary";
import { useClubRanking } from "@/hooks/useClubRanking";
import { useSuggestedPartners, useMatchAgenda } from "@/hooks/useCancha";
import { GeneralRankingTab } from "@/components/ranking/GeneralRankingTab";
import { RATING_SPORT_LABEL } from "@/lib/rating-utils";

const TABS = ["progreso", "subir", "conexion", "ranking"] as const;

const STATE_LABEL: Record<string, { label: string; cls: string }> = {
  por_jugar: { label: "Por jugar", cls: "text-info border-info/30 bg-info/10" },
  vencido_sin_resultado: { label: "Por cargar", cls: "text-fichas border-fichas/30 bg-fichas/10" },
  confirmado: { label: "Confirmado", cls: "text-verde border-verde/30 bg-verde/10" },
  por_confirmar: { label: "Por confirmar", cls: "text-action border-action/30 bg-action/10" },
};

const Cancha = () => {
  const { user } = useAuth();
  const { ratingSport, sport } = useActiveSport();
  const { data: summary, loading } = useUserProfileSummary(user?.id ?? null, ratingSport);
  const { rows: ranking } = useClubRanking(sport);
  const { data: suggested = [] } = useSuggestedPartners(2);
  const { data: agenda = [] } = useMatchAgenda();
  const [params, setParams] = useSearchParams();
  const tabParam = params.get("tab");
  const tab = (TABS as readonly string[]).includes(tabParam ?? "") ? (tabParam as string) : "progreso";
  const setTab = (v: string) => setParams(v === "progreso" ? {} : { tab: v }, { replace: true });
  const dbSport = sport === "padel" ? "padel" : "tennis";

  const nivel = summary?.rating?.level ?? null;
  const myRank = ranking.find((r) => r.user_id === user?.id)?.rank_position ?? null;
  const zonaLo = nivel != null ? Math.max(0, Math.round(nivel) - 1) : 0;
  const zonaHi = nivel != null ? Math.round(nivel) : 0;
  const inviteCount = agenda.filter((a) => a.state === "por_jugar" || a.state === "por_confirmar").length;

  return (
    <div className="min-h-screen bg-background">
      <div className="safe-top sticky top-0 z-30 px-3 pt-2">
        <CoinHud
          className="mx-auto max-w-md lg:max-w-6xl"
          rating={nivel != null ? Number(nivel).toFixed(1) : "—"}
        />
      </div>

      <main className="mx-auto max-w-md md:max-w-2xl space-y-4 px-0 pb-28 pt-3">
        {/* Título + selector de deporte */}
        <div className="flex items-center justify-center gap-3 px-5">
          <h1 className="font-display text-lg font-bold tracking-tight text-foreground">Cancha</h1>
          <SportSwitcher />
        </div>

        <Tabs value={tab} onValueChange={setTab} className="px-5">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="progreso">Progreso</TabsTrigger>
            <TabsTrigger value="subir">Subir</TabsTrigger>
            <TabsTrigger value="conexion">Conexión</TabsTrigger>
            <TabsTrigger value="ranking">Ranking</TabsTrigger>
          </TabsList>

          {/* ───────────── PROGRESO ───────────── */}
          <TabsContent value="progreso" className="mt-4 space-y-4">
            {nivel != null && (
              <>
                <div className="space-y-3">
                  <ArenaHero
                    nivel={nivel}
                    categoria={summary?.rating?.category ?? "—"}
                    sport={RATING_SPORT_LABEL[ratingSport]}
                  />
                  {/* Zona de juego (banda 35–65%) — derivada del nivel, solo info. */}
                  <div className="rounded-2xl border border-skill/25 bg-skill/[0.05] px-4 py-3 text-center">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      Zona de juego · rivales para ti
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-foreground">
                      Niv {zonaLo}–{zonaHi} · donde ganas 35–65%
                    </p>
                  </div>
                </div>

                {/* Camino de ascenso (Addendum A) — empuja a Conexión. */}
                <AscensionPathCard nivel={nivel} onGoConexion={() => setTab("conexion")} />

                {/* Accesos a la vida competitiva existente (absorbe /ranking). */}
                <div className="grid grid-cols-2 gap-3">
                  <Link
                    to="/escalerilla"
                    className="flex items-center justify-between rounded-2xl border border-action/30 bg-card p-4 shadow-card transition-smooth hover:bg-muted"
                  >
                    <span>
                      <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-action">
                        <Swords className="h-3.5 w-3.5" /> Escalerilla
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">Tu posición y retos</span>
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                  <Link
                    to="/espacios"
                    className="flex items-center justify-between rounded-2xl border border-info/30 bg-card p-4 shadow-card transition-smooth hover:bg-muted"
                  >
                    <span>
                      <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-info">
                        <Trophy className="h-3.5 w-3.5" /> Ranking
                      </span>
                      <span className="mt-1 block text-sm font-bold text-foreground">
                        {myRank != null ? `#${myRank}` : "Ver"}
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                </div>
              </>
            )}
            {loading && <div className="h-40 animate-pulse rounded-[22px] border border-border bg-card/60" aria-hidden />}
          </TabsContent>

          {/* ───────────── SUBIR ───────────── */}
          <TabsContent value="subir" className="mt-4 space-y-4">
            {/* Racha · Liga · XP (capa oro/enganche). */}
            <EconomyStrip />

            {/* Guardarraíl explícito: capas separadas (constancia ≠ nivel). */}
            <div className="mx-5 flex items-start gap-2 rounded-2xl border border-border bg-card/60 px-4 py-3">
              <Zap className="mt-0.5 h-4 w-4 shrink-0 text-fichas" />
              <p className="text-sm leading-relaxed text-muted-foreground">
                La constancia sube tu <span className="font-semibold text-fichas">Liga</span>, no tu{" "}
                <span className="font-semibold text-skill">Nivel</span>. El nivel solo sube jugando partidos.
              </p>
            </div>
          </TabsContent>

          {/* ───────────── CONEXIÓN ───────────── */}
          <TabsContent value="conexion" className="mt-4 space-y-4">
            {/* Accesos rápidos (Invitaciones / Agenda). Las pantallas son de M5. */}
            <div className="grid grid-cols-2 gap-3">
              <Link to="/invitaciones" className="flex items-center gap-2 rounded-2xl border border-border bg-card p-4 shadow-card transition-smooth hover:bg-muted">
                <Mail className="h-5 w-5 text-action" />
                <span>
                  <span className="block text-sm font-bold text-foreground">Invitaciones</span>
                  <span className="block text-xs text-muted-foreground">
                    {inviteCount > 0 ? `${inviteCount} en agenda` : "sin pendientes"}
                  </span>
                </span>
              </Link>
              <Link to="/agenda" className="flex items-center gap-2 rounded-2xl border border-border bg-card p-4 shadow-card transition-smooth hover:bg-muted">
                <Calendar className="h-5 w-5 text-info" />
                <span>
                  <span className="block text-sm font-bold text-foreground">Agenda</span>
                  <span className="block text-xs text-muted-foreground">{agenda.length} partidos</span>
                </span>
              </Link>
            </div>

            {/* Llamados abiertos de la comunidad (M4). */}
            <Link
              to="/cancha/llamados"
              className="flex items-center gap-3 rounded-2xl border border-action/30 bg-action/[0.05] p-4 shadow-card transition-smooth hover:bg-action/10"
            >
              <Megaphone className="h-5 w-5 shrink-0 text-action" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-foreground">Llamados a jugar</span>
                <span className="block text-xs text-muted-foreground">Disponibilidad abierta · el primero que pueda, juega</span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>

            {/* Buscar partner (resumen, 2 sugeridos de tu Zona). Retar/Perfil = M3. */}
            <section className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-card">
              <p className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-action">
                <span>Buscar partner · parejo + cerca</span>
                <Link to="/cancha/buscar" className="text-muted-foreground hover:text-foreground">ver todos →</Link>
              </p>
              {suggested.length === 0 && (
                <p className="text-xs text-muted-foreground">Aún no hay rivales sugeridos en tu Zona.</p>
              )}
              {suggested.map((p) => (
                <div key={p.user_id} className="flex items-center gap-3">
                  <UserAvatar kind={p.avatar_kind} look={p.avatar_look} url={p.avatar_url} name={p.name ?? "Rival"} className="h-11 w-11 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-sm font-bold text-foreground">{p.name ?? "Rival"}</p>
                    <p className="text-xs font-semibold text-skill">
                      Niv {p.nivel != null ? Number(p.nivel).toFixed(0) : "—"} · match {p.match_pct}%
                    </p>
                    <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {p.shared_space_name ? `parejo · ${p.shared_space_name}` : "parejo · tu nivel"}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    <Button asChild variant="clay" size="sm"><Link to={`/cancha/reto/${p.user_id}`}>Retar</Link></Button>
                    <Button asChild variant="outline" size="sm"><Link to={`/jugador/${p.user_id}`}>Perfil</Link></Button>
                  </div>
                </div>
              ))}
            </section>

            {/* Partidos en contexto (agenda real: challenges + retos de escalera). */}
            <section className="space-y-2 px-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Partidos en contexto</p>
              {agenda.length === 0 && (
                <p className="rounded-2xl border border-border bg-card/60 px-4 py-3 text-xs text-muted-foreground">
                  No tienes partidos agendados todavía.
                </p>
              )}
              {agenda.map((a) => {
                const st = STATE_LABEL[a.state] ?? STATE_LABEL.por_jugar;
                return (
                  <div key={`${a.kind}-${a.ref_id}`} className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-card">
                    <UserAvatar kind={a.opponent_avatar_kind} look={a.opponent_avatar_look} url={a.opponent_avatar_url} name={a.opponent_name ?? "Rival"} className="h-10 w-10 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">vs {a.opponent_name ?? "rival"}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {a.space_name ?? (a.kind === "escalerilla" ? "Escalerilla" : "Reto")}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${st.cls}`}>{st.label}</span>
                  </div>
                );
              })}
            </section>
          </TabsContent>

          {/* ───────────── RANKING general (deporte + modalidad) ───────────── */}
          <TabsContent value="ranking" className="mt-4">
            <GeneralRankingTab dbSport={dbSport} />
          </TabsContent>
        </Tabs>

        <AppFooter />
      </main>

      <BottomNav />
    </div>
  );
};

export default Cancha;
