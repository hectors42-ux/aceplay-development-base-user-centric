import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  parseEventDefaults,
  resolveCategoryConfig,
  type ResolvedConfig,
} from "@/lib/tournament-presets";

/**
 * Resuelve la configuración efectiva de una categoría haciendo merge con los
 * defaults del torneo padre. Devuelve también qué claves vienen heredadas.
 */
export function useResolvedCategoryConfig(categoryId: string | null | undefined) {
  return useQuery<ResolvedConfig | null>({
    queryKey: ["resolved-category-config", categoryId],
    enabled: !!categoryId,
    queryFn: async () => {
      if (!categoryId) return null;
      const { data: cat, error } = await supabase
        .from("tournament_categories")
        .select("config, preset_key, tournament_id")
        .eq("id", categoryId)
        .maybeSingle();
      if (error) throw error;
      if (!cat) return null;
      const { data: tour } = await supabase
        .from("tournaments")
        .select("default_config")
        .eq("id", cat.tournament_id)
        .maybeSingle();
      return resolveCategoryConfig(
        parseEventDefaults(tour?.default_config),
        parseEventDefaults(cat.config),
      );
    },
    staleTime: 30_000,
  });
}