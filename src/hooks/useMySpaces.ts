// Espacios = pertenencia activa. Agrega, por CLUB donde el usuario compite, su
// identidad + competencias activas (escalerilla y/o torneo) + pendientes + live.
// SOLO LECTURA: reusa space/space_membership + RPCs ya cableadas (list_escalerillas,
// list_tournament_categories). NO crea tablas ni toca el motor.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import { useActiveSport } from "@/components/providers/SportProvider";

// El SportProvider usa español ("tenis"/"padel"); space.sport y los RPC usan
// inglés ("tennis"/"padel"). Mapeamos al inglés ANTES de filtrar o nada matchea.
const toDbSport = (s: "tenis" | "padel"): "tennis" | "padel" => (s === "padel" ? "padel" : "tennis");

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
  // Marca del club (club_profile.branding): el club expone su identidad aquí.
  logoUrl: string | null;
  brandColor: string | null;
  initials: string | null;
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
  const { sport } = useActiveSport();
  const dbSport = toDbSport(sport); // "tennis" | "padel" — el valor de space.sport / RPC.
  const query = useQuery<MySpace[]>({
    // El deporte va en la queryKey: cache correcta por deporte y re-filtra en vivo al togglear.
    queryKey: ["my-spaces", user?.id, dbSport],
    enabled: !!user,
    queryFn: async () => {
      const uid = user!.id;
      const [spacesRes, escRes, catRes, memRes, matchRes, brandRes] = await Promise.all([
        supabase.from("space").select("id, name, type, parent_space_id, sport, slug").in("type", ["club", "escalerilla", "tournament", "category"]),
        supabase.rpc("list_escalerillas"),
        supabase.rpc("list_tournament_categories"),
        supabase.from("space_membership").select("space_id").eq("player_id", uid).eq("status", "active"),
        supabase.from("matches").select("space_id").eq("confirmation_status", "pending").or(`side_a.cs.{${uid}},side_b.cs.{${uid}}`),
        supabase.from("club_profile").select("space_id, branding"),
      ]);

      const spaces = (spacesRes.data as SpaceRow[] | null) ?? [];
      const byId = new Map(spaces.map((s) => [s.id, s]));
      const brandById = new Map<string, { logo_url?: string | null; primary?: string | null; initials?: string | null }>();
      for (const b of ((brandRes.data as { space_id: string; branding: Record<string, unknown> | null }[] | null) ?? [])) {
        if (b.branding) brandById.set(b.space_id, b.branding as { logo_url?: string | null; primary?: string | null; initials?: string | null });
      }
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
          const brand = brandById.get(clubId);
          c = {
            clubId,
            clubName: cs.name,
            sport,
            relation: myClubIds.has(clubId) ? "socio" : "inscrito",
            live: false,
            pendingTotal: 0,
            competitions: [],
            logoUrl: brand?.logo_url ?? null,
            brandColor: brand?.primary ?? null,
            initials: brand?.initials ?? null,
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
        if (sport !== dbSport) continue; // respeta el deporte activo global
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
        if (sport !== dbSport) continue; // respeta el deporte activo global
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

      const list = [...clubs.values()]
        .filter((c) => c.competitions.length > 0) // sin competencias del deporte activo → fuera
        .map((c) => ({ ...c, live: c.pendingTotal > 0 }));
      // Accionable primero: pendientes/vivo desc, luego con más competencias.
      list.sort((a, b) => b.pendingTotal - a.pendingTotal || b.competitions.length - a.competitions.length);
      return list;
    },
  });

  return { spaces: query.data ?? [], loading: query.isLoading };
}

export { sportLabel };
