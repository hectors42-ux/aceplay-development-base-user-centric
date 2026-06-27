import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Swords, ChevronRight, Flame, Trophy, Sparkles } from "lucide-react";
import { CoinHud } from "@/components/home/CoinHud";
import { SportSwitcher } from "@/components/SportSwitcher";
import { BottomNav } from "@/components/BottomNav";
import { AppFooter } from "@/components/AppFooter";
import { TeToca } from "@/components/home/TeToca";
import { HeroAscension } from "@/components/home/HeroAscension";
import { SponsorLockup } from "@/components/SponsorLockup";
import { ArenaHero } from "@/components/arena";
import { UserAvatar } from "@/components/avatar/UserAvatar";
import { useAuth } from "@/components/providers/AuthProvider";
import { useActiveSport } from "@/components/providers/SportProvider";
import { useUserProfileSummary } from "@/hooks/useUserProfileSummary";
import { useXP, useLeague, useStreak, tierName } from "@/hooks/useEconomy";
import { RATING_SPORT_LABEL } from "@/lib/rating-utils";
import { prefetchAppRoutes } from "@/lib/prefetch-routes";

// Inicio = RESUMIR y ENRUTAR (no duplicar lo que vive en /cancha). Responde
// "¿qué hago ahora?" de un vistazo. 4 bloques: hero+ascenso · "te toca" · CTA
// Competir · pulso ligero. Solo lee y enruta (firewall: no escribe nada).
const Index = () => {
  const { user, profile } = useAuth();
  const { ratingSport } = useActiveSport();
  const { data: summary, loading } = useUserProfileSummary(user?.id ?? null, ratingSport);
  const { data: xp } = useXP();
  const { data: league = [] } = useLeague();
  const { data: streak } = useStreak();

  useEffect(() => {
    prefetchAppRoutes();
  }, []);

  const nivel = summary?.rating?.level ?? null;
  const hasOverdue = agenda.some((a) => a.state === "vencido_sin_resultado");
  const myLeague = league.find((m) => m.is_me);
  const name = profile ? `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() : "";

  return (
    <div className="min-h-screen bg-background">
      {/* HUD doble moneda (liquid glass): identidad + RATING(volt) + FICHAS(oro) + racha */}
      <div className="safe-top sticky top-0 z-30 px-3 pt-2">
        <CoinHud className="mx-auto max-w-md" rating={nivel != null ? Number(nivel).toFixed(1) : "—"} />
      </div>

      <main className="mx-auto max-w-md space-y-4 px-0 pb-28 pt-3">
        <div className="flex justify-center px-5">
          <SportSwitcher />
        </div>

        {/* BLOQUE 1 · HERO IDENTIDAD + ASCENSO (lo único "grande") → /cancha (Progreso). */}
        {nivel != null && (
          <section className="px-5" aria-label="Tu categoría y camino de ascenso">
            <Link to="/cancha" aria-label="Ir a Cancha · Progreso" className="block">
              <ArenaHero
                nivel={nivel}
                categoria={summary?.rating?.category ?? "—"}
                sport={RATING_SPORT_LABEL[ratingSport]}
                avatar={
                  <span className="block rounded-full ring-2 ring-skill/50">
                    <UserAvatar kind={profile?.avatar_kind} look={profile?.avatar_look} url={profile?.avatar_url} name={name || "Rally"} className="h-16 w-16" />
                  </span>
                }
                footer={<HeroAscension nivel={nivel} />}
              />
            </Link>
          </section>
        )}
        {loading && nivel == null && (
          <div className="mx-5 h-64 animate-pulse rounded-[28px] border border-border bg-card/60" aria-hidden />
        )}

        {/* BLOQUE 2 · "TE TOCA": CTA contextual inteligente (UNA acción, la de mayor
            prioridad: cargar resultado · aceptar reto · retar en escalerilla · buscar).
            Es el PRIMARIO visual de la pantalla. */}
        <TeToca />

        {/* BLOQUE 3 · COMPETIR → /cancha. SECUNDARIO: puerta discreta al hub completo,
            no compite con el CTA contextual de arriba. */}
        <div className="px-5">
          <Link to="/cancha" className="flex items-center justify-between rounded-2xl border border-border bg-card/60 px-4 py-3 shadow-card transition-smooth hover:bg-muted">
            <span className="flex items-center gap-2">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                <Swords className="h-4 w-4" />
              </span>
              <span className="text-sm font-semibold text-foreground">Ir a Cancha · todo lo competitivo</span>
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        </div>

        {/* BLOQUE 4 · PULSO LIGERO (estado, no hero): racha · liga · XP → /cancha (Subir). */}
        <div className="px-5">
          <Link to="/cancha" aria-label="Ir a Cancha · Subir" className="flex items-center justify-around rounded-2xl border border-border bg-card/60 px-4 py-3 shadow-card transition-smooth hover:bg-muted">
            <span className="flex items-center gap-1.5 text-sm font-bold text-action">
              <Flame className="h-4 w-4" />
              <span className="tabular-nums">{streak?.current_weeks ?? 0}</span>
              <span className="text-[10px] font-medium uppercase text-muted-foreground">sem</span>
            </span>
            <span className="h-5 w-px bg-border" />
            <span className="flex items-center gap-1.5 text-sm font-bold text-fichas">
              <Trophy className="h-4 w-4" />
              {myLeague?.tier != null ? tierName(myLeague.tier) : "—"}
            </span>
            <span className="h-5 w-px bg-border" />
            <span className="flex items-center gap-1.5 text-sm font-bold text-skill">
              <Sparkles className="h-4 w-4" />
              <span className="tabular-nums">{xp?.xp_week ?? 0}</span>
              <span className="text-[10px] font-medium uppercase text-muted-foreground">XP</span>
            </span>
          </Link>
        </div>

        {/* Sponsor (placement existente, sin precios). */}
        <SponsorLockup scope="home" />

        <AppFooter />
      </main>

      <BottomNav />
    </div>
  );
};

export default Index;
