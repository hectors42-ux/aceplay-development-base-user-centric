import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Badge = Database["public"]["Tables"]["badges"]["Row"];
export type UserBadge = Database["public"]["Tables"]["user_badges"]["Row"] & {
  badge?: Badge;
};

export const useUserBadges = (userId?: string) => {
  const [items, setItems] = useState<UserBadge[]>([]);
  const [allBadges, setAllBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const [{ data: userRows }, { data: catalog }] = await Promise.all([
        userId
          ? supabase
              .from("user_badges")
              .select("*, badge:badges(*)")
              .eq("user_id", userId)
              .order("awarded_at", { ascending: false })
          : Promise.resolve({ data: [] as UserBadge[] }),
        supabase.from("badges").select("*").order("category"),
      ]);
      if (!alive) return;
      setItems((userRows ?? []) as UserBadge[]);
      setAllBadges((catalog ?? []) as Badge[]);
      setLoading(false);
    };
    void load();
    return () => {
      alive = false;
    };
  }, [userId]);

  return { items, allBadges, loading };
};
