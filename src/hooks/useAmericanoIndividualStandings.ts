import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface AmericanoStandingRow {
  category_id: string;
  user_id: string;
  matches_played: number;
  matches_won: number;
  games_won: number;
  games_against: number;
  games_diff: number;
  position: number;
}

export function useAmericanoIndividualStandings(categoryId: string | undefined) {
  const [rows, setRows] = useState<AmericanoStandingRow[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!categoryId) return;
    setLoading(true);
    const { data } = await supabase
      .from("americano_individual_standings" as never)
      .select("*")
      .eq("category_id", categoryId)
      .order("position");
    setLoading(false);
    setRows((data as unknown as AmericanoStandingRow[]) ?? []);
  }, [categoryId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { rows, loading, reload };
}