import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import { useActiveSport, type ActiveSport } from "@/components/providers/SportProvider";

export interface CoachWithProfile {
  id: string;
  user_id: string;
  tenant_id: string;
  is_head_coach: boolean;
  is_active: boolean;
  accepts_external: boolean;
  bio_pro: string | null;
  certifications: string | null;
  specialties: string[] | null;
  languages: string[] | null;
  years_coaching: number | null;
  hourly_rate_member_clp: number;
  hourly_rate_shared_clp: number;
  hourly_rate_external_clp: number;
  display_order: number;
  photo_url: string | null;
  sports: string[];
  profile: {
    user_id: string;
    first_name: string;
    last_name: string;
    avatar_url: string | null;
    email: string;
    phone: string | null;
  } | null;
}

export const useCoaches = (sportOverride?: ActiveSport) => {
  const { profile } = useAuth();
  const { sport: activeSport } = useActiveSport();
  const sport = sportOverride ?? activeSport;

  return useQuery({
    queryKey: ["coaches", profile?.tenant_id, sport],
    enabled: !!profile?.tenant_id,
    queryFn: async (): Promise<CoachWithProfile[]> => {
      const { data: coaches, error } = await supabase
        .from("coach_profiles")
        .select("*")
        .eq("tenant_id", profile!.tenant_id)
        .eq("is_active", true)
        .contains("sports", [sport])
        .order("is_head_coach", { ascending: false })
        .order("display_order", { ascending: true });

      if (error) throw error;
      if (!coaches?.length) return [];

      const userIds = coaches.map((c) => c.user_id);
      const { data: profiles } = await supabase
        .from("profiles_directory")
        .select("user_id, first_name, last_name, avatar_url, email, phone")
        .in("user_id", userIds);

      const byUserId = new Map(profiles?.map((p) => [p.user_id, p]));
      return coaches.map((c) => ({
        ...c,
        profile: byUserId.get(c.user_id) ?? null,
      })) as CoachWithProfile[];
    },
  });
};


export const useMyCoachProfile = () => {
  const { user, profile } = useAuth();

  return useQuery({
    queryKey: ["my-coach-profile", user?.id],
    enabled: !!user?.id && !!profile?.tenant_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coach_profiles")
        .select("*")
        .eq("user_id", user!.id)
        .eq("tenant_id", profile!.tenant_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
};
