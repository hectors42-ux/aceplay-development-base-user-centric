// Resolución de presets de co-marca desde DATOS (tabla cobrand_presets).
// Ningún nombre de cliente vive en código: se leen de la BD. Solo lectura.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CobrandPreset } from "@/lib/cobrand-registry";

const COLS =
  "brand_key, display_name, eyebrow_text, lockup_text, flag_country, primary_hex, accent_hex, gradient_css, logo_url, rights_text, active";

export function useCobrandPresets() {
  const query = useQuery<CobrandPreset[]>({
    queryKey: ["cobrand-presets"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cobrand_presets")
        .select(COLS)
        .eq("active", true)
        .order("display_name");
      if (error) throw error;
      return (data as CobrandPreset[] | null) ?? [];
    },
  });
  return { presets: query.data ?? [], loading: query.isLoading };
}

/** Resuelve un preset por brand_key (o null). */
export function useCobrandPreset(brandKey: string | null | undefined) {
  const { presets, loading } = useCobrandPresets();
  const preset = brandKey ? presets.find((p) => p.brand_key === brandKey) ?? null : null;
  return { preset, loading };
}
