import { Navigate, useLocation } from "react-router-dom";
import { useEffect, useState, type ReactNode } from "react";
import { useAuth, type AppRole } from "@/components/providers/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { DuesGate } from "@/components/DuesGate";
import { AppShell } from "@/components/AppShell";
import { hasCachedRatingOnboarding, markRatingOnboardingDone } from "@/lib/onboarding";

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: AppRole | AppRole[];
  /** Si true (default), bloquea acceso si el usuario no completó el cuestionario de nivel inicial */
  requireRatingOnboarding?: boolean;
  /** Si true, no envuelve en AppShell (útil para onboarding fullscreen). */
  bareLayout?: boolean;
}

export const ProtectedRoute = ({
  children,
  requiredRole,
  requireRatingOnboarding = true,
  bareLayout = false,
}: ProtectedRouteProps) => {
  const location = useLocation();
  const { user, roles, loading } = useAuth();
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [hasOnboarding, setHasOnboarding] = useState(false);

  useEffect(() => {
    if (!user || !requireRatingOnboarding) {
      setOnboardingChecked(true);
      return;
    }

    // Cache por usuario en sessionStorage para evitar re-chequeos en cada navegación
    const navState = (location.state as { onboardingCompleted?: boolean } | null);
    if (navState?.onboardingCompleted) {
      markRatingOnboardingDone(user.id);
      setHasOnboarding(true);
      setOnboardingChecked(true);
      return;
    }

    if (hasCachedRatingOnboarding(user.id)) {
      setHasOnboarding(true);
      setOnboardingChecked(true);
      return;
    }

    let cancel = false;
    (async () => {
      // Reintenta el RPC ante errores transitorios de red (típicos justo
      // después del login: "TypeError: Load failed"). Sin esto, caíamos al
      // fallback "asumir completado" → se renderizaba Home un instante y
      // luego un re-chequeo redirigía a /onboarding/nivel (el flash que el
      // usuario reporta).
      const delays = [0, 300, 800, 1500];
      let lastError: unknown = null;
      let data: unknown = null;
      let ok = false;

      for (let i = 0; i < delays.length; i++) {
        if (cancel) return;
        if (delays[i] > 0) {
          await new Promise((r) => setTimeout(r, delays[i]));
          if (cancel) return;
        }
        const res = await supabase.rpc("has_completed_rating_onboarding", {
          _user_id: user.id,
        });
        if (!res.error) {
          data = res.data;
          ok = true;
          break;
        }
        lastError = res.error;
      }

      if (cancel) return;

      if (!ok) {
        // Tras varios reintentos sigue fallando: asumimos completado para
        // no atrapar al usuario en un loop al onboarding cuando el problema
        // es de red.
        console.error("[ProtectedRoute] onboarding check error tras reintentos", lastError);
        setHasOnboarding(true);
        setOnboardingChecked(true);
        return;
      }

      const done = Boolean(data);
      if (done) {
        markRatingOnboardingDone(user.id);
      }
      setHasOnboarding(done);
      setOnboardingChecked(true);
    })();

    return () => {
      cancel = true;
    };
  }, [user, requireRatingOnboarding, location.state]);

  if (loading || (user && !onboardingChecked)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-pulse rounded-full bg-primary/20" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  if (
    requireRatingOnboarding &&
    !hasOnboarding &&
    location.pathname !== "/onboarding/nivel"
  ) {
    return <Navigate to="/onboarding/nivel" replace />;
  }

  if (requiredRole) {
    const required = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    const ok = required.some((r) => roles.includes(r)) || roles.includes("super_admin");
    if (!ok) {
      return <Navigate to="/" replace />;
    }
  }

  return (
    <AppShell bare={bareLayout}>
      <DuesGate>{children}</DuesGate>
    </AppShell>
  );
};
