// ¿el usuario actual puede GESTIONAR este espacio (torneo/categoría)? — gate vivo
// del motor (space_can_manage: organizador del espacio/ancestro o admin). Solo lectura.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";

export function useCanManageSpace(spaceId: string | undefined | null) {
  const { user } = useAuth();
  const query = useQuery<boolean>({
    queryKey: ["can-manage-space", spaceId, user?.id],
    enabled: !!spaceId && !!user,
    queryFn: async () => {
      const { data } = await supabase.rpc("space_can_manage", { _space_id: spaceId! });
      return Boolean(data);
    },
  });
  return { canManage: query.data ?? false, loading: query.isLoading };
}
