import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import type { UserAvatarData } from "@/components/avatar/UserAvatar";

/**
 * Resuelve el avatar {kind, look, url, name} de un usuario. Sin userId (o el
 * propio) usa el profile de la sesión; para otros consulta profiles. El
 * componente correcto (foto vs Rally) lo decide <UserAvatar/> con estos datos.
 */
export function useAvatar(userId?: string | null): UserAvatarData & { isLoading: boolean } {
  const { user, profile } = useAuth();
  const isSelf = !userId || userId === user?.id;

  const q = useQuery({
    queryKey: ["avatar", userId],
    enabled: !isSelf && !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("avatar_kind, avatar_look, avatar_url, display_name")
        .eq("id", userId!)
        .maybeSingle();
      return data;
    },
  });

  if (isSelf) {
    return {
      kind: profile?.avatar_kind ?? "rally",
      look: profile?.avatar_look ?? "classic",
      url: profile?.avatar_url ?? null,
      name: `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim(),
      isLoading: false,
    };
  }
  const d = q.data as { avatar_kind?: string; avatar_look?: string; avatar_url?: string; display_name?: string } | null | undefined;
  return {
    kind: d?.avatar_kind ?? "rally",
    look: d?.avatar_look ?? "classic",
    url: d?.avatar_url ?? null,
    name: d?.display_name ?? "",
    isLoading: q.isLoading,
  };
}
