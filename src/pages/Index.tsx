import { useEffect } from "react";
import { CoinHud } from "@/components/home/CoinHud";
import { SportSwitcher } from "@/components/SportSwitcher";
import { QuickActions } from "@/components/QuickActions";
import { BottomNav } from "@/components/BottomNav";

import { MatchOfTheWeekCard } from "@/components/home/MatchOfTheWeekCard";
import { EconomyStrip } from "@/components/home/EconomyStrip";
import { SponsorLockup } from "@/components/SponsorLockup";
import { HomeRecentMatchesCard } from "@/components/home/HomeRecentMatchesCard";
import { PendingConfirmationsCard } from "@/components/home/PendingConfirmationsCard";
import { useAuth } from "@/components/providers/AuthProvider";
import { Link } from "react-router-dom";
import { ArenaHero, Steps } from "@/components/arena";
import { RATING_SPORT_LABEL } from "@/lib/rating-utils";
import { useUserProfileSummary } from "@/hooks/useUserProfileSummary";
import { useActiveSport } from "@/components/providers/SportProvider";
import { useClubBrand } from "@/components/providers/ClubBrandProvider";
import { prefetchAppRoutes } from "@/lib/prefetch-routes";

const Index = () => {
  const { profile, user, loading: authLoading } = useAuth();
  const { ratingSport } = useActiveSport();
  const { brand } = useClubBrand();
  const { data: summary, loading: summaryLoading } = useUserProfileSummary(user?.id ?? null, ratingSport);

  // Prefetch de rutas del bottom-nav durante el idle del navegador.
  // Acelera la primera navegación a Reservar/Torneos/Ranking/Perfil.
  useEffect(() => {
    prefetchAppRoutes();
  }, []);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Buen día" : hour < 19 ? "Buenas tardes" : "Buenas noches";
  const memberName = authLoading && !profile ? "" : profile ? `${profile.first_name} ${profile.last_name}`.trim() : "Socio";

  return (
    <div className="min-h-screen bg-background">
      {/* HUD doble moneda (liquid glass): logo + RATING(volt) + FICHAS(oro) + racha */}
      <div className="safe-top sticky top-0 z-30 px-3 pt-2">
        <CoinHud
          className="mx-auto max-w-md lg:max-w-6xl"
          rating={!summaryLoading && summary?.rating?.level != null ? Number(summary.rating.level).toFixed(1) : "—"}
        />
      </div>

      <main className="mx-auto max-w-md md:max-w-2xl lg:max-w-3xl xl:max-w-6xl space-y-3 pb-28 md:pb-12 pt-2 px-0 lg:px-6">
        {/* saludo + selector de deporte */}
        <div className="flex items-center justify-between gap-3 px-5">
          <div className="leading-tight">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">{greeting}</p>
            <h1 className="font-display text-2xl font-bold text-foreground">{memberName}</h1>
          </div>
          <SportSwitcher />
        </div>

        <div className="xl:grid xl:grid-cols-3 xl:gap-6 space-y-3 xl:space-y-0">
          <div className="xl:col-span-2 space-y-3">
            {/* HERO — categoría con anillo volt (capa habilidad). Link a Perfil. */}
            {!summaryLoading && summary?.rating?.level != null && (
              <section className="px-5" aria-label="Tu categoría actual">
                <Link to="/perfil" aria-label="Tu nivel" className="block">
                  <ArenaHero
                    nivel={summary.rating.level}
                    categoria={summary.rating.category ?? "—"}
                    sport={RATING_SPORT_LABEL[ratingSport]}
                  />
                </Link>
              </section>
            )}
            {/* CAMINO de ascenso (7 pasos) */}
            {!summaryLoading && summary?.rating?.level != null && (
              <section className="px-5" aria-label="Camino de ascenso de nivel">
                <div className="rounded-2xl border border-border bg-card/60 p-3">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Camino de ascenso · habilidad
                  </p>
                  <Steps current={Math.round(summary.rating.level)} />
                </div>
              </section>
            )}
            {/* CAPAS ENGANCHE + PREMIO (Liga/XP · Racha · Fichas) + misiones. */}
            <EconomyStrip />
            {/* DESAFÍO DEL DÍA */}
            <MatchOfTheWeekCard />
            {/* POR CONFIRMAR */}
            <PendingConfirmationsCard />
            <SponsorLockup scope="home" />
            <HomeRecentMatchesCard />
          </div>
          <aside className="space-y-3">
            <QuickActions />
          </aside>
        </div>

        <footer className="space-y-1 px-5 pt-2 text-center">
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            {brand.name} · {new Date().getFullYear()}
          </p>
          <p className="text-[10px] text-muted-foreground/80">
            Todos los derechos reservados.
          </p>
        </footer>
      </main>

      <BottomNav />
    </div>
  );
};

export default Index;

