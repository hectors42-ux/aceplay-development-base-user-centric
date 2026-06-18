import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import type { RatingSport } from "@/lib/rating-utils";

/**
 * Deporte activo seleccionado globalmente por el socio.
 * El switcher del header alterna entre estos dos valores; el resto de la app
 * (Home, Perfil, Ranking, La Pirámide, Torneos, Reservar) filtra por este valor.
 */
export type ActiveSport = "tenis" | "padel";

const STORAGE_KEY = "aceplay:active-sport";

interface SportContextValue {
  sport: ActiveSport;
  setSport: (s: ActiveSport) => void;
  /**
   * Mapea el deporte activo al enum `rating_sport` de la BD.
   * Para tenis devuelve singles por defecto; usa `setRatingSport` si necesitas dobles.
   */
  ratingSport: RatingSport;
}

const SportContext = createContext<SportContextValue | null>(null);

const readInitial = (): ActiveSport => {
  if (typeof window === "undefined") return "tenis";
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === "padel" ? "padel" : "tenis";
};

export const SportProvider = ({ children }: { children: React.ReactNode }) => {
  const { user, profile } = useAuth();
  const [sport, setSportState] = useState<ActiveSport>(readInitial);

  // Hidratar desde el perfil SOLO la primera vez que carga el perfil y si no
  // hay valor previo en localStorage. Si el usuario ya eligió un deporte
  // (vía el switcher o vía el onboarding de un segundo deporte), respetamos
  // su elección y NO la sobrescribimos en cada refreshProfile().
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(STORAGE_KEY)) return;
    const pref = (profile as { preferred_sport?: string } | null)?.preferred_sport;
    if (pref === "tenis" || pref === "padel") {
      setSportState(pref);
      window.localStorage.setItem(STORAGE_KEY, pref);
    }
  }, [profile]);

  const setSport = useCallback(
    (next: ActiveSport) => {
      setSportState(next);
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // ignore
      }
      if (user?.id) {
        void supabase
          .from("profiles")
          .update({ preferred_sport: next })
          .eq("user_id", user.id);
      }
    },
    [user?.id],
  );

  const value = useMemo<SportContextValue>(
    () => ({
      sport,
      setSport,
      ratingSport: sport === "padel" ? "padel" : "tenis_singles",
    }),
    [sport, setSport],
  );

  return <SportContext.Provider value={value}>{children}</SportContext.Provider>;
};

export const useActiveSport = (): SportContextValue => {
  const ctx = useContext(SportContext);
  if (!ctx) {
    // Fallback seguro si algún componente se monta fuera del provider (tests, storybook).
    return {
      sport: "tenis",
      setSport: () => {},
      ratingSport: "tenis_singles",
    };
  }
  return ctx;
};
