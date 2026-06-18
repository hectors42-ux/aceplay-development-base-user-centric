import { useEffect, useMemo, useRef, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAuth } from "@/components/providers/AuthProvider";
import { useTournamentCobrand } from "@/hooks/useTournamentCobrand";
import { useShareCardData, useShareStandings } from "@/hooks/useShareCardData";
import { useActiveMoment } from "@/hooks/useActiveMoment";
import { ShareCard, type ShareKind } from "./ShareCard";
import { ShareActionBar } from "./ShareActionBar";
import { buildShareUrl } from "@/lib/share-card-copy";
import { trackEvent } from "@/lib/analytics";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tournamentId: string;
  tournamentName: string;
  slug: string;
}

/**
 * Bottom sheet con carousel horizontal de share cards.
 * Solo muestra variantes aplicables al usuario actual.
 */
export function ShareSheet({ open, onOpenChange, tournamentId, tournamentName, slug }: Props) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { cobrand } = useTournamentCobrand(tournamentId);
  const { stats } = useShareCardData(tournamentId, userId ?? undefined);
  const { moment } = useActiveMoment(tournamentId, userId ?? undefined);
  const { standings } = useShareStandings(tournamentId, stats.category_id ?? null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const kinds = useMemo<ShareKind[]>(() => {
    const list: ShareKind[] = [];
    if (stats.is_winner) list.push("champion");
    if (moment.active) list.push("moment");
    list.push("standings");
    if (stats.found) list.push("day");
    if (stats.found) list.push("profile");
    return list;
  }, [stats.is_winner, stats.found, moment.active]);

  useEffect(() => {
    if (activeIndex >= kinds.length) setActiveIndex(0);
  }, [kinds.length, activeIndex]);

  useEffect(() => {
    if (!open) return;
    const kind = kinds[activeIndex];
    if (kind) trackEvent("share_card_opened", { kind, tournament_id: tournamentId });
  }, [open, activeIndex, kinds, tournamentId]);

  const active = kinds[activeIndex];
  const shareUrl = active ? buildShareUrl(slug, active, userId) : "";
  const shareText = active
    ? `Mira mi ${active === "champion" ? "título" : active === "standings" ? "torneo" : "día"} en ${tournamentName}`
    : tournamentName;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto rounded-t-3xl px-4 pb-8 pt-4">
        <SheetHeader className="text-left">
          <SheetTitle className="font-display text-xl">Compartir mi día</SheetTitle>
        </SheetHeader>

        {kinds.length === 0 && (
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Aún no hay cards disponibles. Juega una ronda y vuelve.
          </p>
        )}

        {kinds.length > 0 && (
          <>
            <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
              {kinds.map((k, i) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setActiveIndex(i)}
                  className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium uppercase tracking-wider transition ${
                    i === activeIndex
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground"
                  }`}
                >
                  {labelFor(k)}
                </button>
              ))}
            </div>

            <div className="mt-2 flex justify-center">
              <div className="origin-top scale-[0.62] sm:scale-75">
                <ShareCard
                  ref={cardRef}
                  kind={active}
                  format="story"
                  cobrand={cobrand}
                  stats={stats}
                  moment={moment}
                  standings={standings}
                  tournamentName={tournamentName}
                  slug={slug}
                  highlightUserId={userId}
                />
              </div>
            </div>

            <div className="mt-4">
              <ShareActionBar
                captureRef={cardRef}
                kind={active}
                shareText={shareText}
                shareUrl={shareUrl}
                cobrandHandle={cobrand?.display_name}
              />
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function labelFor(kind: ShareKind): string {
  switch (kind) {
    case "champion":
      return "Campeón";
    case "moment":
      return "Momento";
    case "standings":
      return "Tabla";
    case "day":
      return "Mi día";
    case "profile":
      return "Perfil";
  }
}