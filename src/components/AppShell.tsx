import type { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { SportBadge } from "@/components/SportBadge";
import { useIsDesktop } from "@/hooks/use-breakpoint";

interface AppShellProps {
  children: ReactNode;
  /** Si true, no renderiza el sidebar (útil en pantallas full-bleed como onboarding). */
  bare?: boolean;
}

/**
 * Layout global de la app autenticada.
 * - Mobile: render directo, BottomNav lo maneja cada página.
 * - Desktop (md+): SidebarProvider + AppSidebar + área de contenido con trigger flotante.
 */
export const AppShell = ({ children, bare = false }: AppShellProps) => {
  const isDesktop = useIsDesktop();

  if (bare || !isDesktop) {
    return <ErrorBoundary scope="app-shell">{children}</ErrorBoundary>;
  }

  return (
    <SidebarProvider defaultOpen>
      <div data-app-shell="desktop" className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <div className="sticky top-0 z-30 flex h-12 items-center gap-2 border-b border-border bg-background/80 px-3 backdrop-blur-md">
            <SidebarTrigger />
            <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Panel del club
            </span>
            <div className="ml-auto">
              <SportBadge />
            </div>
          </div>
          <main className="flex-1 min-w-0">
            <ErrorBoundary scope="app-shell">{children}</ErrorBoundary>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};
