import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";

export interface ClubBrand {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  primary: string;
  primaryGlow: string;
  primaryDeep: string;
  logoUrl: string | null;
  ladderLabel: string;
}

const ACEPLAY_FALLBACK: ClubBrand = {
  id: "fallback",
  slug: "aceplay-demo",
  name: "AcePlay Demo Club",
  shortName: "AcePlay",
  primary: "16 62% 44%",
  primaryGlow: "22 73% 57%",
  primaryDeep: "13 71% 26%",
  logoUrl: null,
  ladderLabel: "Escalerilla",
};

import { createContext, useContext } from "react";

interface ClubBrandState {
  brand: ClubBrand;
  loading: boolean;
}

const ClubBrandContext = createContext<ClubBrandState | undefined>(undefined);

export const ClubBrandProvider = ({ children }: { children: React.ReactNode }) => {
  const { profile, user } = useAuth();
  const [brand, setBrand] = useState<ClubBrand>(ACEPLAY_FALLBACK);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadBrand = async () => {
      // Sin sesión: cargar el primer tenant (piloto) para que /auth tenga branding
      setLoading(true);
      const query = profile?.tenant_id
        ? supabase.from("tenants").select("*").eq("id", profile.tenant_id).maybeSingle()
        : supabase.from("tenants").select("*").order("created_at", { ascending: true }).limit(1).maybeSingle();

      const { data } = await query;
      if (data) {
        setBrand({
          id: data.id,
          slug: data.slug,
          name: data.name,
          shortName: data.short_name,
          primary: data.brand_primary,
          primaryGlow: data.brand_primary_glow,
          primaryDeep: data.brand_primary_deep,
          logoUrl: data.logo_url,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ladderLabel: ((data as any).ladder_label as string) || "Escalerilla",
        });
      }
      setLoading(false);
    };
    loadBrand();
  }, [profile?.tenant_id, user?.id]);

  // NOTA: Antes este efecto inyectaba --brand-primary/* en :root para tintar la app.
  // A partir del selector de Tema (Arcilla AcePlay / US Open / Wimbledon), los tokens de color
  // los maneja exclusivamente ThemeContext. ClubBrandProvider ahora solo expone metadata
  // (logo, nombre, shortName) — sin tocar variables CSS.

  return (
    <ClubBrandContext.Provider value={{ brand, loading }}>
      {children}
    </ClubBrandContext.Provider>
  );
};

export const useClubBrand = () => {
  const ctx = useContext(ClubBrandContext);
  if (!ctx) throw new Error("useClubBrand must be used within ClubBrandProvider");
  return ctx;
};
