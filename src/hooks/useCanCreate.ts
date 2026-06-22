import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";

/**
 * ¿El usuario puede crear escalerillas/torneos? (es organizador/admin de un club).
 * Se apoya en el RPC core my_organizer_club() — devuelve el club que organiza, o null.
 */
export const useCanCreate = () => {
  const { user } = useAuth();
  const [clubId, setClubId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) { setClubId(null); return; }
    let cancel = false;
    void supabase.rpc("my_organizer_club").then(({ data }) => {
      if (!cancel) setClubId((data as string | null) ?? null);
    });
    return () => { cancel = true; };
  }, [user]);

  return { canCreate: !!clubId, clubId };
};
