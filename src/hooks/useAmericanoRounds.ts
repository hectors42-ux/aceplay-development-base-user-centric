import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface AmericanoRound {
  id: string;
  tournament_category_id: string;
  round_number: number;
  status: "pendiente" | "en_juego" | "finalizada";
  bye_user_ids: string[];
  tournament_session_id: string | null;
  created_at: string;
}

export function useAmericanoRounds(categoryId: string | undefined) {
  const [rounds, setRounds] = useState<AmericanoRound[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!categoryId) return;
    setLoading(true);
    const { data } = await supabase
      .from("americano_rounds" as never)
      .select("id, tournament_category_id, round_number, status, bye_user_ids, tournament_session_id, created_at")
      .eq("tournament_category_id", categoryId)
      .order("round_number");
    setLoading(false);
    setRounds((data as unknown as AmericanoRound[]) ?? []);
  }, [categoryId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { rounds, loading, reload };
}