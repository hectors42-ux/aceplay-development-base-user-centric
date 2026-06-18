import type { ReactNode } from "react";
import {
  AnalyticsFiltersContext,
  useAnalyticsFiltersValue,
} from "@/hooks/analytics/useAnalyticsFilters";

export function AnalyticsFiltersProvider({ children }: { children: ReactNode }) {
  const value = useAnalyticsFiltersValue();
  return (
    <AnalyticsFiltersContext.Provider value={value}>{children}</AnalyticsFiltersContext.Provider>
  );
}
