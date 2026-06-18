// TODO: cablear fase 2
import { useQuery } from "@tanstack/react-query";

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

export function useTournamentFinance(_categoryId: string | undefined) {
  // TODO: cablear fase 2
  return useQuery<TournamentFinanceRow | null>({
    queryKey: ["stub-tournament-finance"],
    queryFn: async () => null,
    enabled: false,
  });
}
