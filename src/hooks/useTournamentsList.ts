// Vitrina de torneos del jugador — CABLEADA al motor existente (solo lectura).
// Fuente autoritativa (respeta visibilidad vía can_access_space): la RPC
// list_tournament_categories. Se enriquece con space (slug/status del torneo) y
// tournament_config (disciplina por categoría). NO toca el motor.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";

export type RecentEnrollee = {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  registered_at: string;
};

export type TournamentCategoryLite = {
  id: string;
  name: string;
  sport: string;
  discipline: string; // tenis_singles | tenis_dobles | padel_dobles
  motor: string;
  players: number;
  enrolled: boolean;
  bracket_ready: boolean;
};

export type TournamentListItem = {
  id: string;
  name: string;
  slug: string;
  status: string; // inscripciones_abiertas | en_curso | finalizado
  tournament_categories: TournamentCategoryLite[];
  tournament_cobrand: null; // el motor no lo expone aquí
  enrolled_count: number;
  capacity: number; // el motor no expone cupo → 0 (la UI lo oculta)
  recent_enrolled: RecentEnrollee[];
  user_registration: { id: string; tournament_category_id: string; status: string } | null;
  user_past_result: string | null;
  // El motor NO expone fechas/cupo → quedan null y la UI las oculta (decisión: ocultar lo ausente).
  registration_closes_at: string | null;
  starts_at: string | null;
  ends_at: string | null;
};

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

// Normaliza el valor de disciplina (config trae 'padel'/'tenis') al vocabulario que
// usa la pantalla: tenis_singles | tenis_dobles | padel_dobles.
const normalizeDiscipline = (v: string | null | undefined): string => {
  const s = (v ?? "").toLowerCase();
  if (s.includes("padel")) return "padel_dobles";
  if (s === "tenis_dobles" || s === "tennis_doubles") return "tenis_dobles";
  return "tenis_singles";
};

export function useTournamentsList() {
  const { user } = useAuth();
  const query = useQuery<TournamentListItem[]>({
    queryKey: ["tournaments-list", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [catsRes, spacesRes, configRes] = await Promise.all([
        supabase.rpc("list_tournament_categories"),
        supabase.from("space").select("id, name, slug, status, parent_space_id, type").in("type", ["tournament", "category"]),
        supabase.from("tournament_config").select("space_id, disciplina"),
      ]);
      if (catsRes.error) throw catsRes.error;
      const cats = (catsRes.data as CategoryRow[] | null) ?? [];
      const spaces = (spacesRes.data as { id: string; name: string; slug: string | null; status: string | null; parent_space_id: string | null; type: string }[] | null) ?? [];
      const configs = (configRes.data as { space_id: string; disciplina: string | null }[] | null) ?? [];

      const catParent = new Map<string, string>();
      const tourMeta = new Map<string, { name: string; slug: string; status: string }>();
      for (const s of spaces) {
        if (s.type === "tournament") tourMeta.set(s.id, { name: s.name, slug: s.slug ?? s.id, status: s.status ?? "active" });
        else if (s.type === "category" && s.parent_space_id) catParent.set(s.id, s.parent_space_id);
      }
      const disc = new Map<string, string>();
      for (const c of configs) if (c.disciplina) disc.set(c.space_id, c.disciplina);

      const byTour = new Map<string, TournamentListItem>();
      for (const c of cats) {
        const tourId = catParent.get(c.category_id);
        const meta = tourId ? tourMeta.get(tourId) : undefined;
        if (!tourId || !meta) continue; // sin el torneo padre no podemos enrutar
        let item = byTour.get(tourId);
        if (!item) {
          item = {
            id: tourId,
            name: meta.name,
            slug: meta.slug,
            status: "inscripciones_abiertas",
            tournament_categories: [],
            tournament_cobrand: null,
            enrolled_count: 0,
            capacity: 0,
            recent_enrolled: [],
            user_registration: null,
            user_past_result: null,
            registration_closes_at: null,
            starts_at: null,
            ends_at: null,
          };
          byTour.set(tourId, item);
        }
        item.tournament_categories.push({
          id: c.category_id,
          name: c.category_name,
          sport: c.sport,
          discipline: normalizeDiscipline(disc.get(c.category_id) ?? c.sport),
          motor: c.motor,
          players: c.players,
          enrolled: c.enrolled,
          bracket_ready: c.bracket_ready,
        });
        item.enrolled_count += c.players;
        if (c.enrolled) item.user_registration = { id: c.category_id, tournament_category_id: c.category_id, status: "confirmada" };
      }

      // Estado derivado del motor: 'finished' → finalizado; con cuadro generado → en
      // curso; sin cuadro → inscripciones abiertas. (El motor no tiene fechas/cupo.)
      return [...byTour.values()].map((t) => {
        const meta = tourMeta.get(t.id);
        const status =
          meta?.status === "finished"
            ? "finalizado"
            : t.tournament_categories.some((c) => c.bracket_ready)
              ? "en_curso"
              : "inscripciones_abiertas";
        return { ...t, status };
      });
    },
  });

  const tournaments = query.data ?? [];
  return {
    tournaments,
    loading: query.isLoading,
    userActiveTournaments: tournaments.filter((t) => t.status === "en_curso" && t.user_registration),
    userHistory: tournaments.filter((t) => t.status === "finalizado" && t.user_registration),
  };
}
