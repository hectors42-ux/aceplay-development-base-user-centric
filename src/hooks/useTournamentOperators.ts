import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type OperatorRow = {
  tournament_id: string;
  user_id: string;
  granted_by: string;
  granted_at: string;
};

export function useTournamentOperators(tournamentId: string | undefined | null) {
  const [operators, setOperators] = useState<OperatorRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tournamentId) {
      setOperators([]);
      setLoading(false);
      return;
    }
    let cancelled = false;

    const load = async () => {
      const { data, error } = await supabase
        .from("tournament_operators")
        .select("tournament_id, user_id, granted_by, granted_at")
        .eq("tournament_id", tournamentId);
      if (cancelled) return;
      if (!error && data) setOperators(data as OperatorRow[]);
      setLoading(false);
    };
    void load();

    const channel = supabase
      .channel(`tournament_operators:${tournamentId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tournament_operators",
          filter: `tournament_id=eq.${tournamentId}`,
        },
        () => {
          void load();
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [tournamentId]);

  return { operators, loading, isOperator: (uid: string) => operators.some((o) => o.user_id === uid) };
}