import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import type { Tables } from "@/integrations/supabase/types";

export type TournamentRow = Tables<"tournaments">;
export type TournamentCategoryRow = Tables<"tournament_categories">;

interface EnrichedState {
  tournament: TournamentRow | null;
  categories: TournamentCategoryRow[];
  enrolledByCat: Record<string, number>;
  totalEnrolled: number;
  totalCapacity: number;
  daysToClose: number | null;
  isEnrolled: boolean;
  myCategoryId: string | null;
  loading: boolean;
}

const initial: EnrichedState = {
  tournament: null,
  categories: [],
  enrolledByCat: {},
  totalEnrolled: 0,
  totalCapacity: 0,
  daysToClose: null,
  isEnrolled: false,
  myCategoryId: null,
  loading: true,
};

export function useTournamentDetailEnriched(slug: string | undefined) {
  const { user } = useAuth();
  const [state, setState] = useState<EnrichedState>(initial);

  useEffect(() => {
    let cancelled = false;
    if (!slug) {
      setState({ ...initial, loading: false });
      return;
    }
    (async () => {
      setState((s) => ({ ...s, loading: true }));
      const { data: t } = await supabase
        .from("tournaments")
        .select("*, tournament_categories(*)")
        .eq("slug", slug)
        .maybeSingle();

      if (cancelled) return;

      if (!t) {
        setState({ ...initial, loading: false });
        return;
      }

      const tournament = t as TournamentRow & { tournament_categories: TournamentCategoryRow[] };
      const cats = (tournament.tournament_categories ?? []).slice().sort(
        (a, b) => a.sort_order - b.sort_order,
      );

      // Conteo de inscripciones confirmadas / pendientes (excluye retirada/rechazada)
      const { data: regs } = await supabase
        .from("tournament_registrations")
        .select("id, tournament_category_id, player1_user_id, player2_user_id, status")
        .eq("tournament_id", tournament.id);

      if (cancelled) return;

      const validRegs = (regs ?? []).filter(
        (r) => r.status !== "rechazada" && r.status !== "retirada",
      );

      const enrolledByCat: Record<string, number> = {};
      for (const c of cats) enrolledByCat[c.id] = 0;
      for (const r of validRegs) {
        enrolledByCat[r.tournament_category_id] = (enrolledByCat[r.tournament_category_id] ?? 0) + 1;
      }

      const totalEnrolled = validRegs.length;
      const totalCapacity = cats.reduce((sum, c) => sum + (c.max_participants ?? 0), 0);

      const myReg = user
        ? validRegs.find(
            (r) => r.player1_user_id === user.id || r.player2_user_id === user.id,
          )
        : undefined;

      const closeMs = new Date(tournament.registration_closes_at).getTime() - Date.now();
      const daysToClose = closeMs > 0 ? Math.ceil(closeMs / (1000 * 60 * 60 * 24)) : 0;

      setState({
        tournament,
        categories: cats,
        enrolledByCat,
        totalEnrolled,
        totalCapacity,
        daysToClose,
        isEnrolled: !!myReg,
        myCategoryId: myReg?.tournament_category_id ?? null,
        loading: false,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, user?.id]);

  return state;
}
