import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";

export interface AvailabilitySlot {
  id?: string;
  weekday: number;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
}

export const useUserAvailability = () => {
  const { user, profile } = useAuth();
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("user_availability")
      .select("id, weekday, starts_at, ends_at, is_active")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("weekday")
      .order("starts_at");
    setSlots((data ?? []) as AvailabilitySlot[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const saveAll = async (next: Omit<AvailabilitySlot, "id">[]) => {
    if (!user || !profile?.tenant_id) return;
    await supabase.from("user_availability").delete().eq("user_id", user.id);
    if (next.length === 0) {
      await refresh();
      return;
    }
    await supabase.from("user_availability").insert(
      next.map((s) => ({
        ...s,
        user_id: user.id,
        tenant_id: profile.tenant_id,
      })),
    );
    await refresh();
  };

  return { slots, loading, refresh, saveAll, hasAvailability: slots.length > 0 };
};
