import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";

export interface PendingConfirmationMatch {
  id: string;
  tournament_category_id: string;
  side_a_user_ids: string[] | null;
  side_b_user_ids: string[] | null;
  winner_side: string | null;
  score: unknown;
  reported_at: string | null;
  reported_by: string | null;
  category?: {
    id: string;
    label: string | null;
    tournament_id: string;
    tournament?: { name: string | null; slug: string | null } | null;
  } | null;
}

export function usePendingConfirmations() {
  const { user } = useAuth();
  const [matches, setMatches] = useState<PendingConfirmationMatch[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.id) {
      setMatches([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("tournament_matches")
      .select(
        "id, tournament_category_id, side_a_user_ids, side_b_user_ids, winner_side, score, reported_at, reported_by, category:tournament_categories(id, label, tournament_id, tournament:tournaments(name, slug))"
      )
      .eq("confirmation_status", "pendiente_confirmacion")
      .or(`side_a_user_ids.cs.{${user.id}},side_b_user_ids.cs.{${user.id}}`)
      .order("reported_at", { ascending: false })
      .limit(20);
    if (!error && data) {
      const filtered = (data as unknown as PendingConfirmationMatch[]).filter(
        (m) => m.reported_by !== user.id,
      );
      setMatches(filtered);
    }
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!user?.id) return;
    const ch = supabase
      .channel(`pending-confirm-${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "tournament_matches" },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user?.id, load]);

  return { matches, loading, reload: load };
}