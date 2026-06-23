// Hooks de la capa de enganche (XP / Liga / Racha / Misiones). Solo lectura,
// separados por deporte (sport_id). No tocan el motor competitivo.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import { useActiveSport } from "@/components/providers/SportProvider";

export interface XpSummary { xp_total: number; xp_week: number }
export interface LeagueMember { league_id: string; tier: number; user_id: string; name: string | null; xp_week: number; rank: number; is_me: boolean }
export interface StreakInfo { current_weeks: number; longest_weeks: number; freezes_available: number }
export interface MissionRow { code: string; title: string; target: number; progress: number; reward_xp: number; completed: boolean }

export const useXP = () => {
  const { user } = useAuth();
  const { ratingSport } = useActiveSport();
  return useQuery<XpSummary>({
    queryKey: ["my-xp", ratingSport, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_xp", { _sport_id: ratingSport });
      if (error) throw error;
      return ((data as XpSummary[] | null)?.[0]) ?? { xp_total: 0, xp_week: 0 };
    },
  });
};

export const useLeague = () => {
  const { user } = useAuth();
  const { ratingSport } = useActiveSport();
  return useQuery<LeagueMember[]>({
    queryKey: ["my-league", ratingSport, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_league", { _sport_id: ratingSport });
      if (error) throw error;
      return (data as LeagueMember[] | null) ?? [];
    },
  });
};

export const useStreak = () => {
  const { user } = useAuth();
  const { ratingSport } = useActiveSport();
  return useQuery<StreakInfo>({
    queryKey: ["my-streak", ratingSport, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_streak", { _sport_id: ratingSport });
      if (error) throw error;
      return ((data as StreakInfo[] | null)?.[0]) ?? { current_weeks: 0, longest_weeks: 0, freezes_available: 0 };
    },
  });
};

export const useMissions = () => {
  const { user } = useAuth();
  return useQuery<MissionRow[]>({
    queryKey: ["my-missions", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_missions");
      if (error) throw error;
      return (data as MissionRow[] | null) ?? [];
    },
  });
};

// Nombres de tier desde el orden de economy_config.league.tiers (fallback estático).
export const TIER_NAMES = ["—", "Bronce", "Plata", "Oro", "Platino", "Diamante"];
export const tierName = (tier: number) => TIER_NAMES[tier] ?? `Tier ${tier}`;
