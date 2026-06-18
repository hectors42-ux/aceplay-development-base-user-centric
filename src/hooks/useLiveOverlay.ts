import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface LiveTournament {
  id: string;
  name: string;
  slug: string;
  status: string;
  current_round: number | null;
  total_rounds: number | null;
  cobrand: {
    display_name: string;
    logo_url: string | null;
    primary_hex: string | null;
    accent_hex: string | null;
    gradient_css: string | null;
    lockup_text: string | null;
  } | null;
}

export interface LiveStandingsRow {
  rank: number;
  display_name: string;
  initials: string;
  points: number;
}

export interface LiveNowPlaying {
  id: string;
  court: string;
  round: number;
  status: string;
  side_a_names: string;
  side_b_names: string;
  score: unknown;
  partial_score: unknown;
}

type Rpc = (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
const rpc = supabase.rpc as unknown as Rpc;

export function useLiveTournament(slug: string | undefined) {
  const [tournament, setTournament] = useState<LiveTournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setLoading(true);
    rpc("get_public_stream_tournament", { _slug: slug }).then(({ data }) => {
      if (cancelled) return;
      if (!data) {
        setTournament(null);
        setNotFound(true);
      } else {
        setTournament(data as unknown as LiveTournament);
        setNotFound(false);
      }
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [slug]);

  return { tournament, loading, notFound };
}

export function useLiveStandings(slug: string | undefined, tournamentId: string | undefined) {
  const [rows, setRows] = useState<LiveStandingsRow[]>([]);
  const load = useCallback(async () => {
    if (!slug) return;
    const { data } = await rpc("get_public_stream_standings", { _slug: slug, _limit: 12 });
    if (data && typeof data === "object" && "rows" in (data as Record<string, unknown>)) {
      setRows(((data as { rows: LiveStandingsRow[] }).rows) ?? []);
    }
  }, [slug]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!tournamentId) return;
    const ch = supabase
      .channel(`live-standings-${tournamentId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "standings_snapshots", filter: `tournament_id=eq.${tournamentId}` },
        () => void load(),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [tournamentId, load]);

  return { rows };
}

export function useLiveNowPlaying(slug: string | undefined, tournamentId: string | undefined) {
  const [match, setMatch] = useState<LiveNowPlaying | null>(null);
  const load = useCallback(async () => {
    if (!slug) return;
    const { data } = await rpc("get_public_stream_now_playing", { _slug: slug });
    const m = (data as { match: LiveNowPlaying | null } | null)?.match ?? null;
    setMatch(m);
  }, [slug]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!tournamentId) return;
    const ch = supabase
      .channel(`live-now-${tournamentId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tournament_stream_featured", filter: `tournament_id=eq.${tournamentId}` }, () => void load())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "tournament_matches", filter: `tournament_id=eq.${tournamentId}` }, () => void load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [tournamentId, load]);

  return { match };
}