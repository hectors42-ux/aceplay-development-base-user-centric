import { Outlet } from "react-router-dom";
import { AnalyticsFiltersProvider } from "@/components/analytics/AnalyticsFiltersProvider";

/**
 * Layout que monta el AnalyticsFiltersProvider en TODAS las rutas hijas.
 * Necesario para que cualquier hook useAnalytics* pueda llamarse en el cuerpo
 * de la página (no solo dentro del JSX devuelto por AnalyticsShell).
 */
export function AnalyticsLayout() {
  return (
    <AnalyticsFiltersProvider>
      <Outlet />
    </AnalyticsFiltersProvider>
  );
}
