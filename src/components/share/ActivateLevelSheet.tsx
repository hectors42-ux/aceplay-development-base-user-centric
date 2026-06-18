import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { HapticButton } from "@/components/feedback/HapticButton";
import { useCelebrate } from "@/hooks/useCelebrate";
import { celebrateMajorOnce } from "@/lib/feedback/celebrateOnce";
import { supabase } from "@/integrations/supabase/client";
import { trackEvent } from "@/lib/analytics";
import { toast } from "@/hooks/use-toast";
import type { TournamentCobrand } from "@/hooks/useTournamentCobrand";
import type { MembershipOffer } from "@/hooks/useTournamentMembershipOffer";
import { useAuth } from "@/components/providers/AuthProvider";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tournamentId: string;
  slug: string;
  offer: MembershipOffer;
  cobrand: TournamentCobrand | null;
}

export function ActivateLevelSheet({
  open,
  onOpenChange,
  tournamentId,
  slug,
  offer,
  cobrand,
}: Props) {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const celebrate = useCelebrate();
  const [phone, setPhone] = useState<string>((profile as { phone?: string } | null)?.phone ?? "");
  const [submitting, setSubmitting] = useState(false);

  const handleClose = (next: boolean) => {
    if (!next && !submitting) {
      trackEvent("activate_level_sheet_dismissed", { tournament_id: tournamentId });
    }
    onOpenChange(next);
  };

  const handleActivate = async () => {
    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc("activate_trial_membership", {
        _tournament_id: tournamentId,
        _phone: phone || null,
      });
      if (error) throw error;
      trackEvent("guest_to_member_converted", {
        tournament_id: tournamentId,
        offer_type: offer.offer_type,
      });
      celebrateMajorOnce(celebrate, `trial:${tournamentId}`, {
        title: "¡Listo!",
        subtitle: "Tu nivel está activo",
      });
      toast({
        title: "Bienvenido a " + (cobrand?.display_name ?? "AcePlay"),
        description: "30 días para reservar y seguir jugando.",
      });
      onOpenChange(false);
      navigate(`/torneos?welcome=${slug}`);
      void data;
    } catch (err) {
      toast({
        title: "No pudimos activar tu nivel",
        description: err instanceof Error ? err.message : "Inténtalo nuevamente",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto rounded-t-2xl">
        <SheetHeader className="text-left">
          {cobrand?.logo_url && (
            <img
              src={cobrand.logo_url}
              alt={cobrand.display_name ?? ""}
              className="mb-2 h-10 w-auto object-contain"
            />
          )}
          <SheetTitle className="font-display text-2xl">{offer.offer_label}</SheetTitle>
        </SheetHeader>

        {offer.offer_terms_md && (
          <div className="mt-4 whitespace-pre-wrap rounded-xl bg-muted/40 p-4 text-sm text-muted-foreground">
            {offer.offer_terms_md}
          </div>
        )}

        <div className="mt-4 space-y-2">
          <label className="text-xs uppercase tracking-[0.24em] text-muted-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>
            Teléfono (opcional)
          </label>
          <Input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+56 9 ..."
            inputMode="tel"
          />
        </div>

        <HapticButton
          level="heavy"
          onClick={handleActivate}
          disabled={submitting}
          className="mt-6 flex h-12 w-full items-center justify-center rounded-full bg-primary text-base font-semibold text-primary-foreground transition disabled:opacity-60"
        >
          {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Activar mi nivel"}
        </HapticButton>

        <button
          type="button"
          onClick={() => handleClose(false)}
          disabled={submitting}
          className="mt-3 w-full text-center text-sm text-muted-foreground"
        >
          Ahora no
        </button>
      </SheetContent>
    </Sheet>
  );
}