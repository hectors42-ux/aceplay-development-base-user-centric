import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const rpc = supabase.rpc.bind(supabase) as unknown as (
  fn: string,
  args: Record<string, unknown>,
) => Promise<{ data: unknown; error: unknown }>;

export interface ShareMoment {
  active: boolean;
  kind?: "streak" | "climb" | "mvp";
  value?: number;
  rank?: number | null;
  delta?: number;
}

export function useActiveMoment(
  tournamentId: string | undefined,
  userId: string | undefined,
) {
  const [moment, setMoment] = useState<ShareMoment>({ active: false });
  const [loading, setLoading] = useState<boolean>(Boolean(tournamentId && userId));

  useEffect(() => {
    if (!tournamentId || !userId) {
      setMoment({ active: false });
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);

    const load = async () => {
      const { data } = await rpc("get_active_share_moment", {
        _tournament_id: tournamentId,
        _user_id: userId,
      });
      if (cancelled) return;
      setMoment((data as unknown as ShareMoment) ?? { active: false });
      setLoading(false);
    };

    void load();

    const ch = supabase
      .channel(`share-moment-${tournamentId}-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tournament_registrations",
          filter: `tournament_id=eq.${tournamentId}`,
        },
        () => void load(),
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [tournamentId, userId]);

  return { moment, loading };
}