import { useState } from "react";
import { History, ArrowRight } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useUserProfileSummary } from "@/hooks/useUserProfileSummary";
import { useActiveSport } from "@/components/providers/SportProvider";
import { RecentMatchesCarousel } from "@/components/ranking/RecentMatchesCarousel";
import { MatchHistorySheet } from "@/components/profile/MatchHistorySheet";

/**
 * Tarjeta compacta para Home: muestra los últimos partidos del usuario en un
 * carrusel reducido. Reusa el cache de `useUserProfileSummary` (mismo queryKey
 * que el perfil), así que NO añade fetches.
 *
 * Si el usuario no tiene partidos, la tarjeta se oculta para no ensuciar la home.
 */
export const HomeRecentMatchesCard = () => {
  const { user, profile } = useAuth();
  const { ratingSport } = useActiveSport();
  const userId = user?.id ?? null;
  const { data, loading } = useUserProfileSummary(userId, ratingSport);
  const [open, setOpen] = useState(false);

  if (!userId || loading) return null;
  const matches = data?.recent_matches ?? [];
  if (matches.length === 0) return null;

  const fullName = profile
    ? `${profile.first_name} ${profile.last_name}`.trim()
    : `${data?.profile.first_name ?? ""} ${data?.profile.last_name ?? ""}`.trim() || "Tú";
  const avatarUrl = profile?.avatar_url ?? data?.profile.avatar_url ?? null;
  const level = data?.rating?.level ?? null;

  return (
    <section className="px-5" aria-label="Últimos partidos">
      <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card px-4 py-3 shadow-card">
        <header className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <History className="h-3.5 w-3.5 text-muted-foreground" />
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Últimos partidos
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-medium text-primary transition-smooth hover:bg-primary/10"
            aria-label="Ver historial completo de partidos"
          >
            Ver historial
            <ArrowRight className="h-3 w-3" />
          </button>
        </header>

        <div className="flex flex-1 items-stretch">
          <RecentMatchesCarousel
            matches={matches.slice(0, 6)}
            meName={fullName}
            meAvatar={avatarUrl}
            meLevel={level}
            basis="basis-[78%] xs:basis-[60%] sm:basis-[48%] md:basis-[42%] lg:basis-[40%] xl:basis-[32%]"
            compact
          />
        </div>
      </div>

      <MatchHistorySheet
        open={open}
        onOpenChange={setOpen}
        userId={userId}
        mode="own"
      />
    </section>
  );
};
