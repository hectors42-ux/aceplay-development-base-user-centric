import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";

export type MatchType = "singles" | "dobles" | "cualquiera";
export type SurfaceFilter = "arcilla" | "cemento" | "cualquiera";

export interface PartnerFilters {
  match_type: MatchType;
  level_delta: number;
  active_30d: boolean;
  not_played_yet: boolean;
  same_category: boolean;
  surface: SurfaceFilter;
}

const DEFAULT: PartnerFilters = {
  match_type: "singles",
  level_delta: 0.5,
  active_30d: true,
  not_played_yet: false,
  same_category: false,
  surface: "cualquiera",
};

const STORAGE_KEY = "aceplay:partner_filters";

const loadLocal = (): PartnerFilters => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT;
    return { ...DEFAULT, ...JSON.parse(raw) };
  } catch {
    return DEFAULT;
  }
};

export const useMatchSearchFilters = () => {
  const { user, profile } = useAuth();
  const [filters, setFiltersState] = useState<PartnerFilters>(loadLocal);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    let active = true;
    supabase
      .from("match_search_filters")
      .select("level_delta, surface")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!active || !data) return;
        setFiltersState((prev) => ({
          ...prev,
          level_delta: Number(data.level_delta) ?? prev.level_delta,
          surface: (data.surface as SurfaceFilter) ?? prev.surface,
        }));
      });
    return () => {
      active = false;
    };
  }, [user]);

  const setFilters = useCallback(
    (patch: Partial<PartnerFilters>) => {
      setFiltersState((prev) => {
        const next = { ...prev, ...patch };
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {}
        return next;
      });
    },
    [],
  );

  const persist = useCallback(async () => {
    if (!user || !profile?.tenant_id) return;
    setLoading(true);
    await supabase.from("match_search_filters").upsert([
      {
        user_id: user.id,
        tenant_id: profile.tenant_id,
        level_delta: filters.level_delta,
        surface:
          filters.surface === "cualquiera"
            ? null
            : (filters.surface as "arcilla" | "cesped" | "dura" | "sintetico"),
        preferred_days: [],
      },
    ]);
    setLoading(false);
  }, [filters, user, profile]);

  return { filters, setFilters, persist, loading };
};
