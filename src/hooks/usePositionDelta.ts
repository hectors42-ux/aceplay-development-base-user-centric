/**
 * usePositionDelta — lee `standings_snapshots` (capturas diarias) para
 * calcular cuántas posiciones subió/bajó el usuario en los últimos 7 días
 * dentro de una categoría de torneo.
 *
 * Si no hay snapshots todavía, retorna `{ delta: 0 }` y el cableado
 * `major` por cambio de posición simplemente no dispara.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PositionDelta {
  delta: number;
  from: number | null;
  to: number | null;
}

export function usePositionDelta(
  categoryId: string | null | undefined,
  userId?: string | null,
): PositionDelta {
  const { data } = useQuery({
    queryKey: ['position-delta', categoryId, userId],
    enabled: !!categoryId && !!userId,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<PositionDelta> => {
      if (!categoryId || !userId) return { delta: 0, from: null, to: null };
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60_000)
        .toISOString()
        .slice(0, 10);
      const { data: rows } = await supabase
        .from('standings_snapshots')
        .select('position, snapshot_date')
        .eq('category_id', categoryId)
        .eq('user_id', userId)
        .gte('snapshot_date', sevenDaysAgo)
        .order('snapshot_date', { ascending: true });
      if (!rows || rows.length < 2) return { delta: 0, from: null, to: null };
      const from = rows[0].position;
      const to = rows[rows.length - 1].position;
      return { delta: from - to, from, to };
    },
  });
  return data ?? { delta: 0, from: null, to: null };
}