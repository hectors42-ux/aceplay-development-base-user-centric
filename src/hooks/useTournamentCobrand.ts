// Co-marca del HERO del torneo = branding del CLUB organizador (solo lectura).
// Resuelve torneo → club → club_profile.branding (logo + color), que ya es la
// marca viva del club (la misma que pinta su tarjeta en Espacios). Devuelve la
// forma que el hero (TorneoDetalle) ya consume. No escribe nada (firewall).
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TournamentCobrand {
  tournament_id: string;
  brand_key: string;
  display_name: string;
  eyebrow_text: string | null;
  lockup_text: string | null;
  flag_country: string | null;
  logo_url: string | null;
  rights_text: string | null;
  primary_hex: string | null;
  accent_hex: string | null;
  gradient_css: string | null;
}

export function useTournamentCobrand(tournamentId: string | undefined | null) {
  const query = useQuery<TournamentCobrand | null>({
    queryKey: ["tournament-cobrand", tournamentId],
    enabled: !!tournamentId,
    queryFn: async () => {
      const { data: tour } = await supabase
        .from("space")
        .select("parent_space_id")
        .eq("id", tournamentId!)
        .maybeSingle();
      const clubId = (tour as { parent_space_id: string | null } | null)?.parent_space_id;
      if (!clubId) return null;

      const [{ data: club }, { data: cp }] = await Promise.all([
        supabase.from("space").select("name").eq("id", clubId).maybeSingle(),
        supabase.from("club_profile").select("branding").eq("space_id", clubId).maybeSingle(),
      ]);
      const branding = (cp as { branding: { primary?: string; logo_url?: string } | null } | null)?.branding ?? null;
      const primary = branding?.primary ?? null;
      const logo = branding?.logo_url ?? null;
      if (!primary && !logo) return null; // club sin marca → hero AcePlay default.

      const clubName = (club as { name: string } | null)?.name ?? "";
      return {
        tournament_id: tournamentId!,
        brand_key: "club",
        display_name: clubName,
        eyebrow_text: null,
        lockup_text: clubName ? `ACEPLAY × ${clubName.toUpperCase()}` : null,
        flag_country: null,
        logo_url: logo,
        rights_text: null,
        primary_hex: primary,
        accent_hex: primary,
        // Gradiente desde el color del club (oscurece hacia abajo → texto blanco legible).
        gradient_css: primary
          ? `linear-gradient(160deg, ${primary} 0%, color-mix(in srgb, ${primary} 62%, #000) 100%)`
          : null,
      };
    },
  });
  return { cobrand: query.data ?? null, loading: query.isLoading };
}
