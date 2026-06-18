import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type TournamentCobrand = Tables<"tournament_cobrand">;

export function useTournamentCobrand(tournamentId: string | undefined | null) {
  const [cobrand, setCobrand] = useState<TournamentCobrand | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(tournamentId));

  useEffect(() => {
    if (!tournamentId) {
      setCobrand(null);
      setLoading(false);
      return;
    }
    let cancelled = false;

    const load = async () => {
      const { data } = await supabase
        .from("tournament_cobrand")
        .select("*")
        .eq("tournament_id", tournamentId)
        .maybeSingle();
      if (cancelled) return;
      setCobrand((data as TournamentCobrand | null) ?? null);
      setLoading(false);
    };

    setLoading(true);
    load();

    const ch = supabase
      .channel(`cobrand-${tournamentId}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tournament_cobrand",
          filter: `tournament_id=eq.${tournamentId}`,
        },
        () => load(),
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [tournamentId]);

  return { cobrand, loading };
}