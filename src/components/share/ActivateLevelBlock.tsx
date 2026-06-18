import { useState } from "react";
import { HapticButton } from "@/components/feedback/HapticButton";
import { trackEvent } from "@/lib/analytics";
import { useTournamentMembershipOffer } from "@/hooks/useTournamentMembershipOffer";
import { useViewerMembership } from "@/hooks/useViewerMembership";
import type { TournamentCobrand } from "@/hooks/useTournamentCobrand";
import { ActivateLevelSheet } from "./ActivateLevelSheet";

interface Props {
  tournamentId: string;
  slug: string;
  cobrand: TournamentCobrand | null;
}

/**
 * PRD 9 · CTA "Activar mi nivel"
 * Solo se muestra si:
 * - hay oferta activa en el torneo
 * - el viewer está autenticado y es guest
 */
export function ActivateLevelBlock({ tournamentId, slug, cobrand }: Props) {
  const { offer } = useTournamentMembershipOffer(tournamentId);
  const { user, isGuest } = useViewerMembership();
  const [open, setOpen] = useState(false);

  if (!offer || !user || !isGuest) return null;

  const handleClick = () => {
    trackEvent("activate_level_clicked", {
      tournament_id: tournamentId,
      offer_type: offer.offer_type,
    });
    setOpen(true);
  };

  const primary = cobrand?.primary_hex ?? "#b6502b";

  return (
    <>
      <div
        className="mx-auto mt-4 max-w-md rounded-2xl border-2 px-5 py-5 text-white shadow-2xl"
        style={{ borderColor: primary, background: `linear-gradient(180deg, ${primary}33 0%, transparent 100%)` }}
      >
        <p
          className="text-[10px] uppercase tracking-[0.32em] text-white/70"
          style={{ fontFamily: "'DM Mono', monospace" }}
        >
          Nuevo
        </p>
        {cobrand?.logo_url && (
          <img
            src={cobrand.logo_url}
            alt={cobrand.display_name ?? ""}
            className="mt-2 h-8 w-auto object-contain"
          />
        )}
        <h3 className="mt-3 font-display text-xl leading-snug">{offer.offer_label}</h3>
        <HapticButton
          level="heavy"
          onClick={handleClick}
          className="mt-4 flex h-12 w-full items-center justify-between rounded-full px-5 text-sm font-semibold text-white transition active:scale-[0.98]"
          style={{ background: primary }}
        >
          <span>Activar mi nivel</span>
          <span className="opacity-80">$0/mes</span>
        </HapticButton>
        <button
          type="button"
          onClick={handleClick}
          className="mt-2 w-full text-center text-xs text-white/70 underline-offset-2 hover:underline"
        >
          Ver condiciones
        </button>
      </div>

      <ActivateLevelSheet
        open={open}
        onOpenChange={setOpen}
        tournamentId={tournamentId}
        slug={slug}
        offer={offer}
        cobrand={cobrand}
      />
    </>
  );
}