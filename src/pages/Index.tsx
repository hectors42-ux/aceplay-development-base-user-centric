import { useEffect } from "react";
import { AppHeader } from "@/components/AppHeader";
import { HeroCard } from "@/components/HeroCard";
import { QuickActions } from "@/components/QuickActions";
import { BottomNav } from "@/components/BottomNav";
import { LevelHeroCard } from "@/components/rating/LevelHeroCard";

import { MatchOfTheWeekCard } from "@/components/home/MatchOfTheWeekCard";
import { EconomyStrip } from "@/components/home/EconomyStrip";
import { HomeRecentMatchesCard } from "@/components/home/HomeRecentMatchesCard";
import { PendingConfirmationsCard } from "@/components/home/PendingConfirmationsCard";
import { useAuth } from "@/components/providers/AuthProvider";
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
      <AppHeader memberName={memberName} greeting={greeting} />

      <main className="mx-auto max-w-md md:max-w-2xl lg:max-w-3xl xl:max-w-6xl space-y-3 pb-28 md:pb-12 pt-2 px-0 lg:px-6">
        {/* xl+ : grid 2/3 + 1/3. Por debajo (incluye desktop angosto con sidebar abierto) apila para evitar columnas estranguladas. */}
        <div className="xl:grid xl:grid-cols-3 xl:gap-6 space-y-3 xl:space-y-0">
          <div className="xl:col-span-2 space-y-3">
            <HeroCard />
            <PendingConfirmationsCard />
            <EconomyStrip />
            <HomeRecentMatchesCard />
            <section className="px-5" aria-label="Tu nivel actual">
              <LevelHeroCard
                level={summary?.rating?.level ?? null}
                category={summary?.rating?.category ?? null}
                delta={summary?.rating?.last_change_delta ?? 0}
                sport={ratingSport}
                rankingPosition={summary?.positions.ranking ?? null}
                ladderPosition={summary?.positions.ladder ?? null}
                ladderStatus={summary?.positions.ladder_status ?? null}
                variant="slim"
                loading={summaryLoading}
                linkToProfile
                className="min-h-[260px] lg:min-h-[280px]"
              />
            </section>
          </div>
          <aside className="space-y-3">
            <MatchOfTheWeekCard />
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

