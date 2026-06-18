import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface RoundMatch {
  id: string;
  round: number;
  bracket_position: number;
  court_id: string | null;
  status: string;
  side_a_user_ids: string[];
  side_b_user_ids: string[];
  americano_round_id: string | null;
  scheduled_at: string | null;
}

export interface PlayerLite {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
}

export interface RegistrationLite {
  player1_user_id: string;
  session_availability: string[] | null;
}

export function useRoundPairs(opts: {
  roundId: string | undefined;
  categoryId: string | undefined;
  tournamentId: string | undefined;
}) {
  const { roundId, categoryId, tournamentId } = opts;
  const [matches, setMatches] = useState<RoundMatch[]>([]);
  const [players, setPlayers] = useState<Map<string, PlayerLite>>(new Map());
  const [registrations, setRegistrations] = useState<RegistrationLite[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!roundId || !categoryId) return;
    setLoading(true);
    const { data: matchRows } = await supabase
      .from("tournament_matches")
      .select(
        "id, round, bracket_position, court_id, status, side_a_user_ids, side_b_user_ids, americano_round_id, scheduled_at",
      )
      .eq("americano_round_id", roundId)
      .order("bracket_position");

    const ms = (matchRows ?? []) as unknown as RoundMatch[];
    setMatches(ms);

    const userIds = new Set<string>();
    ms.forEach((m) => {
      (m.side_a_user_ids ?? []).forEach((u) => u && userIds.add(u));
      (m.side_b_user_ids ?? []).forEach((u) => u && userIds.add(u));
    });

    const { data: regRows } = await supabase
      .from("tournament_registrations")
      .select("player1_user_id, session_availability")
      .eq("tournament_category_id", categoryId)
      .eq("status", "confirmada");
    const regs = ((regRows ?? []) as unknown) as RegistrationLite[];
    setRegistrations(regs);
    regs.forEach((r) => userIds.add(r.player1_user_id));

    if (userIds.size > 0) {
      const { data: profileRows } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name")
        .in("user_id", Array.from(userIds));
      const map = new Map<string, PlayerLite>();
      (profileRows ?? []).forEach((p) =>
        map.set(p.user_id as string, p as PlayerLite),
      );
      setPlayers(map);
    }
    setLoading(false);
  }, [roundId, categoryId]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Realtime: re-cargar si llega broadcast para esta ronda
  useEffect(() => {
    if (!roundId || !tournamentId) return;
    const channel = supabase
      .channel(`tournament:${tournamentId}:round:${roundId}`)
      .on("broadcast", { event: "partner_changed" }, () => {
        reload();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [roundId, tournamentId, reload]);

  const availabilityByUser = useMemo(() => {
    const m = new Map<string, string[] | null>();
    registrations.forEach((r) => m.set(r.player1_user_id, r.session_availability));
    return m;
  }, [registrations]);

  return { matches, setMatches, players, availabilityByUser, loading, reload };
}