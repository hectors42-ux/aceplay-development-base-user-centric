/**
 * useConsecutiveWins — racha de victorias consecutivas del usuario actual
 * dentro de una categoría de torneo. Lee `tournament_registrations.consecutive_wins`
 * (mantenido por trigger `trg_update_consecutive_wins`).
 *
 * Si el usuario no está inscrito, devuelve 0.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useConsecutiveWins(
  categoryId: string | null | undefined,
  userId: string | null | undefined,
): number {
  const { data } = useQuery({
    queryKey: ['consecutive-wins', categoryId, userId],
    enabled: !!categoryId && !!userId,
    staleTime: 60_000,
    queryFn: async (): Promise<number> => {
      if (!categoryId || !userId) return 0;
      const { data: rows } = await supabase
        .from('tournament_registrations')
        .select('consecutive_wins')
        .eq('tournament_category_id', categoryId)
        .or(`player1_user_id.eq.${userId},player2_user_id.eq.${userId}`)
        .limit(1);
      return rows?.[0]?.consecutive_wins ?? 0;
    },
  });
  return data ?? 0;
}