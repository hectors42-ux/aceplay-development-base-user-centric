import { useEffect, useMemo, useRef } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/providers/AuthProvider";
import { useTournamentDetailEnriched } from "@/hooks/useTournamentDetailEnriched";
import { useTournamentCobrand } from "@/hooks/useTournamentCobrand";
import { useShareCardData, useShareStandings } from "@/hooks/useShareCardData";
import { useActiveMoment } from "@/hooks/useActiveMoment";
import { ShareCard, type ShareKind } from "@/components/share/ShareCard";
import { ShareActionBar } from "@/components/share/ShareActionBar";
import { ActivateLevelBlock } from "@/components/share/ActivateLevelBlock";
import { buildShareUrl } from "@/lib/share-card-copy";
import { trackEvent } from "@/lib/analytics";

const KINDS: ShareKind[] = ["champion", "moment", "standings", "day", "profile"];

const SharePage = () => {
  const { slug } = useParams<{ slug: string }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const rawKind = (params.get("kind") ?? "day") as ShareKind;
  const kind: ShareKind = KINDS.includes(rawKind) ? rawKind : "day";
  const targetUserId = params.get("userId") ?? user?.id ?? null;

  const { tournament, loading } = useTournamentDetailEnriched(slug);
  const { cobrand } = useTournamentCobrand(tournament?.id);
  const { stats } = useShareCardData(tournament?.id, targetUserId ?? undefined);
  const { moment } = useActiveMoment(tournament?.id, targetUserId ?? undefined);
  const { standings } = useShareStandings(tournament?.id, stats.category_id ?? null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (tournament?.id) {
      trackEvent("share_card_opened", { kind, tournament_id: tournament.id });
    }
  }, [kind, tournament?.id]);

  const shareUrl = useMemo(
    () => (slug ? buildShareUrl(slug, kind, targetUserId) : ""),
    [slug, kind, targetUserId],
  );
  const shareText = tournament
    ? `Mira mi ${kind === "champion" ? "título" : kind === "standings" ? "torneo" : "día"} en ${tournament.name}`
    : "Mira mi día en AcePlay";

  if (loading || !tournament) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[hsl(var(--ink))]">
        <Loader2 className="h-6 w-6 animate-spin text-white" />
      </div>
    );
  }

  const eligible =
    (kind === "champion" && stats.is_winner) ||
    (kind === "moment" && moment.active) ||
    kind === "standings" ||
    kind === "day" ||
    kind === "profile";

  return (
    <div
      className="min-h-screen overflow-y-auto pb-32 pt-4"
      style={{
        background:
          "radial-gradient(ellipse at top, hsl(var(--ink-dark)) 0%, hsl(var(--ink)) 70%, #0c0805 100%)",
      }}
    >
      <header className="mx-auto flex max-w-md items-center justify-between px-4">
        <button
          type="button"
          onClick={() => navigate(`/torneos/${slug}`)}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/20"
          aria-label="Volver"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <p
          className="text-[10px] uppercase tracking-[0.32em] text-white/70"
          style={{ fontFamily: "'DM Mono', monospace" }}
        >
          {kindLabel(kind)}
        </p>
        <span className="h-9 w-9" />
      </header>

      {!eligible && (
        <div className="mx-auto mt-12 max-w-md px-6 text-center text-white/80">
          <p className="font-display text-2xl">Aún no disponible</p>
          <p className="mt-2 text-sm text-white/60">
            Esta tarjeta se activa cuando completes la condición correspondiente
            (campeonato finalizado, racha de victorias, etc.).
          </p>
          <Button asChild className="mt-6">
            <Link to={`/torneos/${slug}`}>Volver al torneo</Link>
          </Button>
        </div>
      )}

      {eligible && (
        <>
          <div className="mx-auto mt-6 flex max-w-md justify-center">
            <div className="origin-top scale-[0.62] sm:scale-75">
              <ShareCard
                ref={ref}
                kind={kind}
                format="story"
                cobrand={cobrand}
                stats={stats}
                moment={moment}
                standings={standings}
                tournamentName={tournament.name}
                slug={slug ?? ""}
                highlightUserId={targetUserId}
              />
            </div>
          </div>

          {kind === "profile" && tournament?.id && (
            <div className="px-4">
              <ActivateLevelBlock
                tournamentId={tournament.id}
                slug={slug ?? ""}
                cobrand={cobrand}
              />
            </div>
          )}

          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[hsl(var(--ink))]/95 px-4 pb-6 pt-3 backdrop-blur">
            <div className="mx-auto max-w-md">
              <ShareActionBar
                captureRef={ref}
                kind={kind}
                shareText={shareText}
                shareUrl={shareUrl}
                cobrandHandle={cobrand?.display_name}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

function kindLabel(k: ShareKind) {
  switch (k) {
    case "champion":
      return "Campeón";
    case "moment":
      return "Momento destacado";
    case "standings":
      return "Tabla en vivo";
    case "day":
      return "Mi día";
    case "profile":
      return "Perfil del torneo";
  }
}

export default SharePage;