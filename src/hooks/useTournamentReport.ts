import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface TournamentReport {
  tournament: {
    id: string;
    name: string;
    starts_at: string | null;
    ends_at: string | null;
    closed_at: string | null;
    cobrand: {
      display_name: string;
      brand_key: string;
      primary_hex: string | null;
      accent_hex: string | null;
      logo_url: string | null;
    } | null;
  };
  participation: {
    confirmed_players: number;
    total_slots: number;
    fill_rate: number;
    category_count: number;
    session_count: number;
    court_count: number;
  };
  play: {
    rounds_total: number;
    matches_played: number;
    matches_total: number;
    completion_rate: number;
  };
  operators: { count: number };
  share: {
    opens: number;
    downloads: number;
    shares: number;
    unique_users: number;
    top_kinds: Array<{ kind: string; count: number }>;
  };
  captacion: {
    activate_clicks: number;
    conversions: number;
    conversion_rate: number;
  };
  ave_clp: number;
  snapshot_at: string;
}

export function useTournamentReport(tournamentId: string | undefined) {
  const [report, setReport] = useState<TournamentReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!tournamentId) return;
    setLoading(true);
    setError(null);
    const { data, error: rpcErr } = await (supabase.rpc as unknown as (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message: string } | null }>)(
      "tournament_report_metrics",
      { _tournament_id: tournamentId },
    );
    if (rpcErr) {
      setError(rpcErr.message);
      setReport(null);
    } else {
      setReport(data as unknown as TournamentReport);
    }
    setLoading(false);
  }, [tournamentId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { report, loading, error, refresh: load };
}