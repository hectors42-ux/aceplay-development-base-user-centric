import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import type { PushCategory } from "@/lib/push-templates";

export type PushPreferences = Record<PushCategory, boolean>;

const DEFAULTS: PushPreferences = { juego: true, marketing: true, sistema: true };

export function useUserPushPreferences() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<PushPreferences>(DEFAULTS);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("user_push_preferences")
      .select("juego, marketing, sistema")
      .eq("user_id", user.id)
      .maybeSingle();
    if (data) setPrefs({ juego: data.juego, marketing: data.marketing, sistema: data.sistema });
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const update = useCallback(
    async (patch: Partial<PushPreferences>) => {
      if (!user) return;
      const next = { ...prefs, ...patch };
      setPrefs(next);
      await supabase.from("user_push_preferences").upsert({ user_id: user.id, ...next });
    },
    [user, prefs],
  );

  return { prefs, loading, update };
}