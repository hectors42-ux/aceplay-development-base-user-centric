import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Link, NavLink } from "react-router-dom";
import { AnalyticsFiltersBar } from "@/components/analytics/AnalyticsFiltersBar";
import { AnalyticsGlossaryDialog } from "@/components/analytics/AnalyticsGlossaryDialog";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/admin/analytics", label: "Resumen", end: true },
  { to: "/admin/analytics/operacion", label: "Operación" },
  { to: "/admin/analytics/finanzas", label: "Finanzas" },
  { to: "/admin/analytics/socios", label: "Socios" },
  { to: "/admin/analytics/coaches", label: "Coaches" },
  { to: "/admin/analytics/comunidad", label: "Comunidad" },
  { to: "/admin/analytics/alertas", label: "Alertas" },
];

interface AnalyticsShellProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  hideFilters?: boolean;
}

export function AnalyticsShell({ title, subtitle, children, hideFilters }: AnalyticsShellProps) {
  return (
    <div className="min-h-screen bg-background">
      {/* Header móvil con back button + glosario */}
      <header className="sticky top-0 z-20 border-b border-border bg-background/85 px-4 py-3 backdrop-blur-md md:px-6">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3">
          <Link
            to="/perfil"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-foreground transition-smooth hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Volver al perfil"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={2.5} />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-primary">Analítica</p>
            <h1 className="truncate font-display text-lg font-semibold leading-tight md:text-2xl">
              {title}
            </h1>
            {subtitle && (
              <p className="hidden text-xs text-muted-foreground md:block">{subtitle}</p>
            )}
          </div>
          <AnalyticsGlossaryDialog />
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl space-y-4 px-4 pb-12 pt-4 md:px-6">
        {subtitle && (
          <p className="text-xs text-muted-foreground md:hidden">{subtitle}</p>
        )}

        <nav
          aria-label="Vistas de analítica"
          className="-mx-4 flex gap-1 overflow-x-auto border-b border-border/60 px-4 [scrollbar-width:none] md:-mx-6 md:px-6 [&::-webkit-scrollbar]:hidden"
        >
          {TABS.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                cn(
                  "whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )
              }
            >
              {t.label}
            </NavLink>
          ))}
        </nav>

        {!hideFilters && <AnalyticsFiltersBar />}

        <div className="space-y-4">
          {children}
        </div>
      </div>
    </div>
  );
}
