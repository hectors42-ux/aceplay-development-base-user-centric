import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface StandingRow {
  category_id: string;
  registration_id: string;
  matches_played: number;
  matches_won: number;
  sets_won: number;
  games_won: number;
  stb_games_won: number;
  total_points: number;
  position: number;
}

export function useRoundRobinStandings(categoryId: string | undefined) {
  const qc = useQueryClient();
  const key = ["round-robin-standings", categoryId];

  const query = useQuery({
    queryKey: key,
    enabled: !!categoryId,
    queryFn: async (): Promise<StandingRow[]> => {
      const { data, error } = await supabase
        .from("round_robin_standings")
        .select("*")
        .eq("category_id", categoryId!)
        .order("position");
      if (error) throw error;
      return (data ?? []).map((r) => ({
        category_id: r.category_id as string,
        registration_id: r.registration_id as string,
        matches_played: r.matches_played ?? 0,
        matches_won: r.matches_won ?? 0,
        sets_won: r.sets_won ?? 0,
        games_won: r.games_won ?? 0,
        stb_games_won: r.stb_games_won ?? 0,
        total_points: Number(r.total_points ?? 0),
        position: r.position ?? 0,
      }));
    },
  });

  useEffect(() => {
    if (!categoryId) return;
    const ch = supabase
      .channel(`rr-standings-${categoryId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tournament_matches",
          filter: `tournament_category_id=eq.${categoryId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: key });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId]);

  return query;
}