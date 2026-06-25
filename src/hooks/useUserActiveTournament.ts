// "Mi torneo activo" — CABLEADO al motor (solo lectura). Deriva de las categorías
// inscritas (list_tournament_categories) + el cuadro (bracket_view). El motor NO
// agenda, así que nextMatch (hora/cancha) queda null y la UI lo oculta; sí se
// derivan el partido reportable y el último resultado desde el cuadro.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";

export type ActiveTournamentInfo = {
  tournament: { id: string; name: string; slug: string; status: string };
  category: { id: string; name: string };
  registrationId: string;
  nextMatch: { id: string; scheduled_at: string; court_name: string | null; rival_name: string } | null;
  reportableMatch: { id: string; scheduled_at: string } | null;
  lastResult: { id: string; won: boolean; rival_name: string; played_at: string | null } | null;
  bracketPublished: boolean;
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
interface BracketSlot {
  slot_id: string;
  round: number;
  slot: number;
  player_a: string | null;
  name_a: string | null;
  player_b: string | null;
  name_b: string | null;
  winner: string | null;
  status: string;
  match_id: string | null;
}

export function useUserActiveTournament() {
  const { user } = useAuth();
  const query = useQuery<ActiveTournamentInfo | null>({
    queryKey: ["user-active-tournament", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const uid = user!.id;
      const { data: cats } = await supabase.rpc("list_tournament_categories");
      const enrolled = ((cats as CategoryRow[] | null) ?? []).filter((c) => c.enrolled && c.bracket_ready);
      if (enrolled.length === 0) return null;
      const active = enrolled[0]; // el primero inscrito con cuadro generado

      const [{ data: spaces }, { data: slots }] = await Promise.all([
        supabase.from("space").select("id, name, slug, status, parent_space_id, type").in("type", ["tournament", "category"]),
        supabase.rpc("bracket_view", { _category_id: active.category_id }),
      ]);
      const sp = (spaces as { id: string; name: string; slug: string | null; status: string | null; parent_space_id: string | null; type: string }[] | null) ?? [];
      const catSpace = sp.find((s) => s.id === active.category_id);
      const tourSpace = catSpace?.parent_space_id ? sp.find((s) => s.id === catSpace.parent_space_id) : undefined;
      if (!tourSpace) return null;

      const mySlots = ((slots as BracketSlot[] | null) ?? []).filter((s) => s.player_a === uid || s.player_b === uid);
      const rivalName = (s: BracketSlot) => (s.player_a === uid ? s.name_b : s.name_a) ?? "Rival";

      const reportable = mySlots.find((s) => s.status === "pending" && s.player_a && s.player_b && !s.winner);
      const last = [...mySlots].reverse().find((s) => s.winner);

      return {
        tournament: { id: tourSpace.id, name: tourSpace.name, slug: tourSpace.slug ?? tourSpace.id, status: tourSpace.status === "finished" ? "finalizado" : "en_curso" },
        category: { id: active.category_id, name: active.category_name },
        registrationId: active.category_id,
        nextMatch: null, // el motor no agenda → sin hora/cancha
        reportableMatch: reportable ? { id: reportable.match_id ?? reportable.slot_id, scheduled_at: "" } : null,
        lastResult: last ? { id: last.match_id ?? last.slot_id, won: last.winner === uid, rival_name: rivalName(last), played_at: null } : null,
        bracketPublished: active.bracket_ready,
      };
    },
  });
  return { data: query.data ?? null, loading: query.isLoading };
}
