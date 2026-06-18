import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Trophy } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useRatingHistory } from "@/hooks/useRatingHistory";
import { useUserProfileSummary } from "@/hooks/useUserProfileSummary";
import { useClubRanking } from "@/hooks/useClubRanking";
import { EvolutionHeroChart } from "@/components/ranking/EvolutionHeroChart";
import { EvolutionDetailSheet } from "@/components/ranking/EvolutionDetailSheet";
import { LevelHeroCard } from "@/components/rating/LevelHeroCard";
import type { ClubRankingRow, RankingSport } from "@/hooks/useClubRanking";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  /** Sport inicial proveniente del tab Ranking. La tab tiene su propio toggle interno. */
  sport: RankingSport;
  ranking: ClubRankingRow[];
  /** Oculta el CTA "Ver mi perfil completo" (útil cuando ya estamos dentro del perfil). */
  hideProfileLink?: boolean;
}

export const MyEvolutionTab = ({ sport: initialSport, ranking: initialRanking, hideProfileLink }: Props) => {
  const { user } = useAuth();
  const [sport, setSport] = useState<RankingSport>(initialSport);
  const { history: allHistory, loading } = useRatingHistory(80);
  const { data: summary } = useUserProfileSummary(user?.id ?? null, sport);
  // Cuando el usuario cambia el deporte dentro de la tab, traemos su ranking propio.
  const { rows: ownRanking, loading: rankingLoading } = useClubRanking(sport);
  const [detailOpen, setDetailOpen] = useState(false);

  const ranking = sport === initialSport && initialRanking.length > 0 ? initialRanking : ownRanking;

  const history = useMemo(
    () => allHistory.filter((h) => h.sport === sport),
    [allHistory, sport],
  );

  const me = useMemo(
    () => ranking.find((r) => r.user_id === user?.id) ?? null,
    [ranking, user],
  );

  // Posición en la Pirámide (viene del summary del usuario, no depende del deporte de ranking)
  const ladderPosition = summary?.positions.ladder ?? null;
  const ladderStatus = summary?.positions.ladder_status ?? null;

  if (loading || rankingLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-[220px] w-full rounded-3xl" />
        <Skeleton className="h-[260px] w-full rounded-3xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toggle Singles / Dobles (oculto cuando el deporte activo es pádel) */}
      {sport !== "padel" && (
        <div className="flex gap-1.5 rounded-2xl border border-border bg-card p-1">
          {(["tenis_singles", "tenis_dobles"] as RankingSport[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSport(s)}
              className={cn(
                "flex-1 rounded-xl px-3 py-2 text-xs font-medium transition-smooth",
                sport === s
                  ? "bg-primary text-primary-foreground shadow-clay"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {s === "tenis_singles" ? "Singles" : "Dobles"}
            </button>
          ))}
        </div>
      )}

      {!me ? (
        <div className="rounded-3xl border border-dashed border-border bg-card/50 p-8 text-center">
          <Trophy className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
          <p className="text-sm font-medium">
            Aún sin datos en {sport === "tenis_singles" ? "singles" : "dobles"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Juega tu primer partido oficial para aparecer en el ranking.
          </p>
        </div>
      ) : (
        <>
          {/* Hero unificado: nivel + categoría + posiciones + racha + fiabilidad */}
          <LevelHeroCard
            level={me.level}
            category={(me.category as "A" | "B" | "C" | null) ?? null}
            delta={summary?.rating?.last_change_delta ?? 0}
            sport={sport}
            rankingPosition={me.rank_position}
            ladderPosition={ladderPosition}
            ladderStatus={ladderStatus}
            streak={me.streak ?? 0}
            reliability={summary?.rating?.reliability}
            matchesPlayed={summary?.rating?.matches_played}
            variant="full"
          />

          {/* Hero gráfica de evolución con toggle 5/10/Todos */}
          <EvolutionHeroChart history={history} onSeeDetails={() => setDetailOpen(true)} />
        </>
      )}

      {!hideProfileLink && (
        <Button asChild variant="outline" className="w-full">
          <Link to="/perfil">
            Ver mi perfil completo
            <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Link>
        </Button>
      )}

      <EvolutionDetailSheet
        open={detailOpen}
        onOpenChange={setDetailOpen}
        history={history}
      />
    </div>
  );
};
