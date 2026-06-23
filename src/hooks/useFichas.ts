// Hooks de la capa de Premio (Fichas → códigos de descuento de marca).
// La UI NUNCA muestra precios en pesos: solo benefit_label + costo en Fichas.
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";

export interface FichasSummary { balance: number; expiring_amount: number; expiring_at: string | null }
export interface RewardRow {
  id: string; brand_id: string; brand_name: string; brand_slug: string;
  title: string; benefit_label: string; cost_fichas: number; stock: number | null; sport_scope: string | null;
}
export interface RewardDetail extends Omit<RewardRow, "brand_id" | "brand_slug"> {
  brand_slug: string; terms: string | null; active: boolean;
}
export interface RedemptionRow {
  id: string; code: string; status: string; created_at: string; used_at: string | null;
  title: string; benefit_label: string; brand_name: string;
}

export const useFichas = () => {
  const { user } = useAuth();
  return useQuery<FichasSummary>({
    queryKey: ["my-fichas", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_fichas");
      if (error) throw error;
      return ((data as FichasSummary[] | null)?.[0]) ?? { balance: 0, expiring_amount: 0, expiring_at: null };
    },
  });
};

export const useRewards = () => {
  const { user } = useAuth();
  return useQuery<RewardRow[]>({
    queryKey: ["rewards", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_rewards");
      if (error) throw error;
      return (data as RewardRow[] | null) ?? [];
    },
  });
};

export const useRewardDetail = (id: string | undefined) => {
  return useQuery<RewardDetail | null>({
    queryKey: ["reward-detail", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("reward_detail", { _id: id });
      if (error) throw error;
      return ((data as RewardDetail[] | null)?.[0]) ?? null;
    },
  });
};

export const useRedemptions = () => {
  const { user } = useAuth();
  return useQuery<RedemptionRow[]>({
    queryKey: ["my-redemptions", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_redemptions");
      if (error) throw error;
      return (data as RedemptionRow[] | null) ?? [];
    },
  });
};

export interface RedeemResult { code: string; redemption_id: string; deduplicated: boolean }

export const useRedeem = () => {
  const qc = useQueryClient();
  return useMutation<RedeemResult, Error, string>({
    mutationFn: async (rewardItemId: string) => {
      const { data, error } = await supabase.rpc("redeem_ficha", { _reward_item_id: rewardItemId });
      if (error) throw error;
      return data as RedeemResult;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-fichas"] });
      qc.invalidateQueries({ queryKey: ["my-redemptions"] });
      qc.invalidateQueries({ queryKey: ["rewards"] });
    },
  });
};
