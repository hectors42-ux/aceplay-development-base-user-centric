import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";

export interface RecentPartner {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  last_played_at: string | null;
  source: string | null;
}

export const useRecentPartners = (limit = 8) => {
  const { user } = useAuth();
  const [rows, setRows] = useState<RecentPartner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let active = true;
    setLoading(true);
    supabase
      .rpc("get_recent_partners", { _limit: limit })
      .then(({ data, error }) => {
        if (!active) return;
        if (!error && data) setRows(data as RecentPartner[]);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user, limit]);

  return { rows, loading };
};
