import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TournamentFinanceRow {
  category_id: string;
  tournament_id: string;
  tenant_id: string;
  entry_fee_clp: number;
  total_count: number;
  paid_count: number;
  collected_clp: number;
  expected_clp: number;
}

export function useTournamentFinance(categoryId: string | undefined) {
  const qc = useQueryClient();
  const key = ["tournament-finance", categoryId];

  const query = useQuery({
    queryKey: key,
    enabled: !!categoryId,
    queryFn: async (): Promise<TournamentFinanceRow | null> => {
      const { data, error } = await supabase
        .from("tournament_finance" as never)
        .select("*")
        .eq("category_id", categoryId!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const r = data as unknown as TournamentFinanceRow;
      return {
        ...r,
        entry_fee_clp: Number(r.entry_fee_clp ?? 0),
        collected_clp: Number(r.collected_clp ?? 0),
        expected_clp: Number(r.expected_clp ?? 0),
        paid_count: Number(r.paid_count ?? 0),
        total_count: Number(r.total_count ?? 0),
      };
    },
  });

  useEffect(() => {
    if (!categoryId) return;
    const ch = supabase
      .channel(`fin-${categoryId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tournament_registrations",
          filter: `tournament_category_id=eq.${categoryId}`,
        },
        () => qc.invalidateQueries({ queryKey: key }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId]);

  return query;
}