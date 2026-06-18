import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";

export type OperatorTournament = {
  id: string;
  slug: string;
  name: string;
  status: string;
};

/**
 * Lista los torneos donde el usuario actual es operador y que están activos
 * (no borrador, no finalizado, no cancelado).
 */
export function useMyOperatorTournaments() {
  const { user } = useAuth();
  const [tournaments, setTournaments] = useState<OperatorTournament[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setTournaments([]);
      setLoading(false);
      return;
    }
    let cancelled = false;

    const load = async () => {
      const { data } = await supabase
        .from("tournament_operators")
        .select("tournament_id, tournaments!inner(id, slug, name, status)")
        .eq("user_id", user.id);
      if (cancelled) return;
      const list: OperatorTournament[] = [];
      (data ?? []).forEach((row) => {
        const t = (row as { tournaments: { id: string; slug: string; name: string; status: string } | null }).tournaments;
        if (!t) return;
        if (t.status === "borrador" || t.status === "finalizado" || t.status === "cancelado") return;
        list.push(t);
      });
      setTournaments(list);
      setLoading(false);
    };
    void load();

    const channel = supabase
      .channel(`my_operator_tournaments:${user.id}:${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tournament_operators", filter: `user_id=eq.${user.id}` },
        () => {
          void load();
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [user]);

  return { tournaments, loading };
}