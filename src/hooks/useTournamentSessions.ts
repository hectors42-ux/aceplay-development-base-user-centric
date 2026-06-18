import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type TournamentSession = {
  id: string;
  tournament_id: string;
  tenant_id: string;
  name: string;
  starts_at: string;
  ends_at: string;
  court_ids: string[];
  block_label: string;
  status: "planificada" | "bloqueada" | "en_curso" | "finalizada";
  created_at: string;
  created_by: string;
};

export const useTournamentSessions = (tournamentId: string | null | undefined) => {
  const [sessions, setSessions] = useState<TournamentSession[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!tournamentId) {
      setSessions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("tournament_sessions" as never)
      .select("*")
      .eq("tournament_id", tournamentId)
      .order("starts_at");
    setSessions((data as TournamentSession[] | null) ?? []);
    setLoading(false);
  }, [tournamentId]);

  useEffect(() => {
    load();
  }, [load]);

  return { sessions, loading, reload: load };
};