import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface MembershipOffer {
  tournament_id: string;
  offer_type: "trial_30d" | "discount_first_month" | "free_first_class";
  offer_label: string;
  offer_terms_md: string | null;
  active: boolean;
  expires_at: string | null;
}

export function useTournamentMembershipOffer(tournamentId: string | null | undefined) {
  const [offer, setOffer] = useState<MembershipOffer | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!tournamentId) {
      setOffer(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase.rpc("get_tournament_membership_offer", {
        _tournament_id: tournamentId,
      });
      if (cancelled) return;
      if (error) {
        setOffer(null);
      } else {
        setOffer((data as unknown as MembershipOffer | null) ?? null);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [tournamentId]);

  return { offer, loading };
}