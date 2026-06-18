import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import type { ReactNode } from "react";

function FullLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center text-muted-foreground">
      Cargando…
    </div>
  );
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { loading, session } = useAuth();
  const loc = useLocation();
  if (loading) return <FullLoader />;
  if (!session) return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  return <>{children}</>;
}

export function RequireOnboarded({ children }: { children: ReactNode }) {
  const { loading, onboarded, profile } = useAuth();
  if (loading || !profile) return <FullLoader />;
  if (!onboarded) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}