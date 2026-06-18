import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";

export function useTournamentAlert() {
  const { user, profile } = useAuth();
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    let cancel = false;
    (async () => {
      const { data } = await supabase
        .from("tournament_alerts")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!cancel) {
        setSubscribed(!!data);
        setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [user]);

  const subscribe = async () => {
    if (!user || !profile?.tenant_id) return false;
    const { error } = await supabase
      .from("tournament_alerts")
      .upsert({ user_id: user.id, tenant_id: profile.tenant_id });
    if (!error) {
      setSubscribed(true);
      return true;
    }
    return false;
  };

  return { subscribed, loading, subscribe };
}
