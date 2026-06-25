// Espacios = pertenencia activa. Agrega, por CLUB donde el usuario compite, su
// identidad + competencias activas (escalerilla y/o torneo) + pendientes + live.
// SOLO LECTURA: reusa space/space_membership + RPCs ya cableadas (list_escalerillas,
// list_tournament_categories). NO crea tablas ni toca el motor.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";

export type SpaceCompetition =
  | { type: "ladder"; spaceId: string; name: string; myRank: number | null; pending: number; route: string }
  | { type: "tournament"; categoryId: string; sport: string; phase: string; hasNext: boolean; pending: number; route: string };

export interface MySpace {
  clubId: string;
  clubName: string;
  sport: string; // tenis | padel (un espacio = un deporte)
  relation: "socio" | "inscrito";
  live: boolean;
  pendingTotal: number;
  competitions: SpaceCompetition[];
}

interface SpaceRow {
  id: string;
  name: string;
  type: string;
  parent_space_id: string | null;
  sport: string | null;
  slug: string | null;
}
interface EscRow {
  space_id: string;
  name: string;
  sport: string | null;
  enrolled: boolean;
  my_rank: number | null;
}
interface CatRow {
  category_id: string;
  tournament_name: string;
  sport: string;
  enrolled: boolean;
  bracket_ready: boolean;
  motor: string;
}

const sportLabel = (s: string | null) => (s === "padel" ? "Pádel" : s === "tennis" ? "Tenis" : "—");
const phaseLabel = (motor: string) =>
  motor === "groups_playoff" ? "fase de grupos"
  : motor === "americano" ? "americano"
  : motor === "round_robin" ? "todos contra todos"
  : "en curso";

export function useMySpaces() {
  const { user } = useAuth();
  const query = useQuery<MySpace[]>({
    queryKey: ["my-spaces", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const uid = user!.id;
      const [spacesRes, escRes, catRes, memRes, matchRes] = await Promise.all([
        supabase.from("space").select("id, name, type, parent_space_id, sport, slug").in("type", ["club", "escalerilla", "tournament", "category"]),
        supabase.rpc("list_escalerillas"),
        supabase.rpc("list_tournament_categories"),
        supabase.from("space_membership").select("space_id").eq("player_id", uid).eq("status", "active"),
        supabase.from("matches").select("space_id").eq("confirmation_status", "pending").or(`side_a.cs.{${uid}},side_b.cs.{${uid}}`),
      ]);

      const spaces = (spacesRes.data as SpaceRow[] | null) ?? [];
      const byId = new Map(spaces.map((s) => [s.id, s]));
      const myClubIds = new Set(
        (((memRes.data as { space_id: string }[] | null) ?? [])
          .map((m) => byId.get(m.space_id))
          .filter((s): s is SpaceRow => !!s && s.type === "club")
          .map((s) => s.id)),
      );
      const pendingBySpace = new Map<string, number>();
      for (const m of ((matchRes.data as { space_id: string | null }[] | null) ?? [])) {
        if (m.space_id) pendingBySpace.set(m.space_id, (pendingBySpace.get(m.space_id) ?? 0) + 1);
      }

      const clubs = new Map<string, MySpace>();
      const ensureClub = (clubId: string, sport: string): MySpace | null => {
        const cs = byId.get(clubId);
        if (!cs) return null;
        let c = clubs.get(clubId);
        if (!c) {
          c = {
            clubId,
            clubName: cs.name,
            sport,
            relation: myClubIds.has(clubId) ? "socio" : "inscrito",
            live: false,
            pendingTotal: 0,
            competitions: [],
          };
          clubs.set(clubId, c);
        }
        return c;
      };

      // Escalerillas inscritas → fila ladder en su club padre.
      for (const e of ((escRes.data as EscRow[] | null) ?? [])) {
        if (!e.enrolled) continue;
        const esc = byId.get(e.space_id);
        const clubId = esc?.parent_space_id;
        if (!clubId) continue;
        const sport = e.sport === "padel" ? "padel" : "tennis";
        const c = ensureClub(clubId, sport);
        if (!c) continue;
        const pending = pendingBySpace.get(e.space_id) ?? 0;
        c.competitions.push({ type: "ladder", spaceId: e.space_id, name: e.name, myRank: e.my_rank, pending, route: "/escalerilla" });
        c.pendingTotal += pending;
      }

      // Torneos inscritos → fila tournament en su club (categoría→torneo→club).
      for (const cat of ((catRes.data as CatRow[] | null) ?? [])) {
        if (!cat.enrolled) continue;
        const catSpace = byId.get(cat.category_id);
        const tourSpace = catSpace?.parent_space_id ? byId.get(catSpace.parent_space_id) : undefined;
        const clubId = tourSpace?.parent_space_id;
        if (!tourSpace || !clubId) continue;
        const sport = cat.sport === "padel" ? "padel" : "tennis";
        const c = ensureClub(clubId, sport);
        if (!c) continue;
        const pending = pendingBySpace.get(cat.category_id) ?? 0;
        c.competitions.push({
          type: "tournament",
          categoryId: cat.category_id,
          sport,
          phase: phaseLabel(cat.motor),
          hasNext: pending > 0,
          pending,
          route: `/torneos/${tourSpace.slug ?? tourSpace.id}/cat/${cat.category_id}`,
        });
        c.pendingTotal += pending;
      }

      const list = [...clubs.values()].map((c) => ({ ...c, live: c.pendingTotal > 0 }));
      // Accionable primero: pendientes/vivo desc, luego con más competencias.
      list.sort((a, b) => b.pendingTotal - a.pendingTotal || b.competitions.length - a.competitions.length);
      return list;
    },
  });

  return { spaces: query.data ?? [], loading: query.isLoading };
}

export { sportLabel };
