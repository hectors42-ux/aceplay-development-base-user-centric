// TODO: cablear fase 2
import { useQuery } from "@tanstack/react-query";
import type { ResolvedConfig } from "@/lib/tournament-presets";

export function useResolvedCategoryConfig(_categoryId: string | null | undefined) {
  // TODO: cablear fase 2
  return useQuery<ResolvedConfig | null>({
    queryKey: ["stub-resolved-category-config"],
    queryFn: async () => null,
    enabled: false,
  });
}
