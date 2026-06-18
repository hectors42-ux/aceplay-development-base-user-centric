// TODO: cablear fase 2
import { useState } from "react";

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

export const useMatchSearchFilters = () => {
  // TODO: cablear fase 2
  const [filters, setFilters] = useState<PartnerFilters>(DEFAULT);
  return {
    filters,
    setFilters,
    persist: async (_next: PartnerFilters) => {},
    loading: false,
  };
};
