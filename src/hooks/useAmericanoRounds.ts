// Rondas de Americano — DERIVADAS de americano_view (agrupando por ronda).
// Solo lectura; no toca el motor. El motor no agenda → starts/ends null.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AmericanoRound {
  id: string;
  round_number: number;
  status: string;
  starts_at: string | null;
  ends_at: string | null;
}

interface ViewRow {
  slot_id: string;
  round: number;
  status: string;
  match_id: string | null;
}

export function useAmericanoRounds(categoryId: string | undefined) {
  const query = useQuery<AmericanoRound[]>({
    queryKey: ["americano-rounds", categoryId],
    enabled: !!categoryId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("americano_view", { _category_id: categoryId });
      if (error) throw error;
      const rows = (data as ViewRow[] | null) ?? [];
      const byRound = new Map<number, ViewRow[]>();
      for (const r of rows) {
        const list = byRound.get(r.round) ?? [];
        list.push(r);
        byRound.set(r.round, list);
      }
      return [...byRound.entries()]
        .sort(([a], [b]) => a - b)
        .map(([round, slots]) => ({
          id: String(round),
          round_number: round,
          status: slots.every((s) => s.status === "played" || s.status === "confirmed") ? "finalizada" : "en_curso",
          starts_at: null,
          ends_at: null,
        }));
    },
  });
  return { rounds: query.data ?? [], loading: query.isLoading, reload: async () => { await query.refetch(); } };
}
