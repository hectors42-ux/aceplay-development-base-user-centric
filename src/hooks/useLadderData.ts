import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import type { Tables } from "@/integrations/supabase/types";

export type LadderRow = Tables<"ladders">;
export type PositionRow = Tables<"ladder_positions">;
export type ChallengeRow = Tables<"ladder_challenges">;
export type HistoryRow = Tables<"ladder_history">;
export type ProfileLite = {
  user_id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
};

interface State {
  loading: boolean;
  ladders: LadderRow[];
  selectedLadder: LadderRow | null;
  positions: PositionRow[];
  challenges: ChallengeRow[];
  history: HistoryRow[];
  profilesById: Record<string, ProfileLite>;
}

export const useLadderData = () => {
  const { user } = useAuth();
  const [state, setState] = useState<State>({
    loading: true,
    ladders: [],
    selectedLadder: null,
    positions: [],
    challenges: [],
    history: [],
    profilesById: {},
  });
  const [selectedLadderId, setSelectedLadderId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));

    const { data: laddersData } = await supabase
      .from("ladders")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    const ladders = (laddersData ?? []) as LadderRow[];
    const ladder =
      (selectedLadderId && ladders.find((l) => l.id === selectedLadderId)) ||
      ladders[0] ||
      null;

    if (!ladder) {
      setState({
        loading: false,
        ladders,
        selectedLadder: null,
        positions: [],
        challenges: [],
        history: [],
        profilesById: {},
      });
      return;
    }

    const [positionsRes, challengesRes, historyRes] = await Promise.all([
      supabase
        .from("ladder_positions")
        .select("*")
        .eq("ladder_id", ladder.id)
        .order("position", { ascending: true }),
      supabase
        .from("ladder_challenges")
        .select("*")
        .eq("ladder_id", ladder.id)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("ladder_history")
        .select("*")
        .eq("ladder_id", ladder.id)
        .order("recorded_at", { ascending: false })
        .limit(40),
    ]);

    const positions = (positionsRes.data ?? []) as PositionRow[];
    const challenges = (challengesRes.data ?? []) as ChallengeRow[];
    const history = (historyRes.data ?? []) as HistoryRow[];

    const userIds = new Set<string>();
    positions.forEach((p) => userIds.add(p.user_id));
    challenges.forEach((c) => {
      userIds.add(c.challenger_user_id);
      userIds.add(c.challenged_user_id);
    });
    history.forEach((h) => userIds.add(h.user_id));

    let profilesById: Record<string, ProfileLite> = {};
    if (userIds.size > 0) {
      const { data: profiles } = await supabase
        .from("profiles_directory")
        .select("user_id, first_name, last_name, avatar_url")
        .in("user_id", Array.from(userIds));
      profilesById = ((profiles ?? []) as ProfileLite[]).reduce(
        (acc, p) => {
          acc[p.user_id] = p;
          return acc;
        },
        {} as Record<string, ProfileLite>,
      );
    }

    setState({
      loading: false,
      ladders,
      selectedLadder: ladder,
      positions,
      challenges,
      history,
      profilesById,
    });
  }, [selectedLadderId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Realtime: refrescar ante cambios en posiciones o desafíos de la Pirámide actual
  useEffect(() => {
    if (!state.selectedLadder) return;
    const ladderId = state.selectedLadder.id;
    const channel = supabase
      .channel(`ladder-${ladderId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ladder_positions", filter: `ladder_id=eq.${ladderId}` },
        () => void load(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ladder_challenges", filter: `ladder_id=eq.${ladderId}` },
        () => void load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [state.selectedLadder, load]);

  const myPosition =
    user && state.positions.find((p) => p.user_id === user.id)
      ? state.positions.find((p) => p.user_id === user.id)!
      : null;

  return {
    ...state,
    myPosition,
    setSelectedLadderId,
    refresh: load,
  };
};
