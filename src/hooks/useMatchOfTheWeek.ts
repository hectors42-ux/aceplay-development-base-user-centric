import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type MotwRow = Database["public"]["Tables"]["match_of_the_week"]["Row"] & {
  player_a_name?: string;
  player_b_name?: string;
  player_a_avatar?: string | null;
  player_b_avatar?: string | null;
};

const startOfWeekIso = () => {
  const d = new Date();
  const day = d.getDay() || 7; // Mon=1..Sun=7
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (day - 1));
  return d.toISOString().slice(0, 10);
};

export const useMatchOfTheWeek = () => {
  const [items, setItems] = useState<MotwRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const week = startOfWeekIso();
      const { data: rows } = await supabase
        .from("match_of_the_week")
        .select("*")
        .eq("week_start", week)
        .order("kind");
      const list = (rows ?? []) as MotwRow[];
      if (list.length > 0) {
        const ids = Array.from(
          new Set(list.flatMap((r) => [r.player_a_id, r.player_b_id])),
        );
        const { data: profs } = await supabase
          .from("profiles_directory")
          .select("user_id, first_name, last_name, avatar_url")
          .in("user_id", ids);
        const byId = new Map((profs ?? []).map((p) => [p.user_id, p]));
        list.forEach((r) => {
          const a = byId.get(r.player_a_id);
          const b = byId.get(r.player_b_id);
          r.player_a_name = a ? `${a.first_name} ${a.last_name}` : "Jugador A";
          r.player_b_name = b ? `${b.first_name} ${b.last_name}` : "Jugador B";
          r.player_a_avatar = a?.avatar_url ?? null;
          r.player_b_avatar = b?.avatar_url ?? null;
        });
      }
      if (!alive) return;
      setItems(list);
      setLoading(false);
    };
    void load();
    return () => {
      alive = false;
    };
  }, []);

  return { items, loading };
};
