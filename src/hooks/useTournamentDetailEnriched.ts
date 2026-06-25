// Detalle/overview de un torneo (/torneos/:slug) — CABLEADO al motor (solo lectura).
// Compone space (torneo por slug) + list_tournament_categories + tournament_config
// (disciplina). El motor no expone fechas/cupo/superficie → null/0 y la UI los oculta.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";

export type TournamentRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  starts_at: string | null;
  ends_at: string | null;
};
export type TournamentCategoryRow = {
  id: string;
  name: string;
  sport: string;
  discipline: string;
  surface: string | null;
  motor: string;
  players: number;
  enrolled: boolean;
  bracket_ready: boolean;
};

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

interface CategoryRow {
  category_id: string;
  category_name: string;
  tournament_name: string;
  sport: string;
  enrolled: boolean;
  players: number;
  bracket_ready: boolean;
  motor: string;
}

const normalizeDiscipline = (v: string | null | undefined): string => {
  const s = (v ?? "").toLowerCase();
  if (s.includes("padel")) return "padel_dobles";
  if (s === "tenis_dobles" || s === "tennis_doubles") return "tenis_dobles";
  return "tenis_singles";
};

export function useTournamentDetailEnriched(slug: string | undefined): EnrichedState {
  const { user } = useAuth();
  const query = useQuery<EnrichedState>({
    queryKey: ["tournament-detail", slug, user?.id],
    enabled: !!slug,
    queryFn: async () => {
      const { data: tourRows } = await supabase
        .from("space")
        .select("id, name, slug, status")
        .eq("type", "tournament")
        .eq("slug", slug!)
        .limit(1);
      const tour = (tourRows as { id: string; name: string; slug: string; status: string | null }[] | null)?.[0];
      if (!tour) {
        return { tournament: null, categories: [], enrolledByCat: {}, totalEnrolled: 0, totalCapacity: 0, daysToClose: null, isEnrolled: false, myCategoryId: null, loading: false };
      }

      const [{ data: cats }, { data: catSpaces }, { data: configs }] = await Promise.all([
        supabase.rpc("list_tournament_categories"),
        supabase.from("space").select("id, parent_space_id, type").eq("type", "category").eq("parent_space_id", tour.id),
        supabase.from("tournament_config").select("space_id, disciplina"),
      ]);
      const childIds = new Set(((catSpaces as { id: string }[] | null) ?? []).map((c) => c.id));
      const disc = new Map<string, string>();
      for (const c of (configs as { space_id: string; disciplina: string | null }[] | null) ?? []) if (c.disciplina) disc.set(c.space_id, c.disciplina);

      const categories: TournamentCategoryRow[] = ((cats as CategoryRow[] | null) ?? [])
        .filter((c) => childIds.has(c.category_id))
        .map((c) => ({
          id: c.category_id,
          name: c.category_name,
          sport: c.sport,
          discipline: normalizeDiscipline(disc.get(c.category_id) ?? c.sport),
          surface: null,
          motor: c.motor,
          players: c.players,
          enrolled: c.enrolled,
          bracket_ready: c.bracket_ready,
        }));

      const enrolledByCat: Record<string, number> = {};
      let totalEnrolled = 0;
      let myCategoryId: string | null = null;
      for (const c of categories) {
        enrolledByCat[c.id] = c.players;
        totalEnrolled += c.players;
        if (c.enrolled) myCategoryId = c.id;
      }
      const status = tour.status === "finished" ? "finalizado" : categories.some((c) => c.bracket_ready) ? "en_curso" : "inscripciones_abiertas";

      return {
        tournament: { id: tour.id, name: tour.name, slug: tour.slug, status, starts_at: null, ends_at: null },
        categories,
        enrolledByCat,
        totalEnrolled,
        totalCapacity: 0,
        daysToClose: null,
        isEnrolled: !!myCategoryId,
        myCategoryId,
        loading: false,
      };
    },
  });

  return query.data ?? { tournament: null, categories: [], enrolledByCat: {}, totalEnrolled: 0, totalCapacity: 0, daysToClose: null, isEnrolled: false, myCategoryId: null, loading: query.isLoading };
}
