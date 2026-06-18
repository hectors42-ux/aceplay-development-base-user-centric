import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import { useActiveSport } from "@/components/providers/SportProvider";
import type { Tables } from "@/integrations/supabase/types";

export type ActiveTournamentInfo = {
  tournament: Tables<"tournaments">;
  category: Pick<Tables<"tournament_categories">, "id" | "name">;
  registrationId: string;
  nextMatch: {
    id: string;
    scheduled_at: string;
    court_name: string | null;
    rival_name: string;
  } | null;
  reportableMatch: {
    id: string;
    scheduled_at: string;
  } | null;
  lastResult: {
    id: string;
    won: boolean;
    rival_name: string;
    played_at: string | null;
  } | null;
  /** true cuando la categoría ya tiene matches creados pero ninguno involucra al usuario */
  bracketPublished: boolean;
};

export function useUserActiveTournament() {
  const { user } = useAuth();
  const { sport: activeSport } = useActiveSport();
  const [data, setData] = useState<ActiveTournamentInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    let cancel = false;
    const load = async () => {
      setLoading(true);
      const { data: regs } = await supabase
        .from("tournament_registrations")
        .select(
          `id, tournament_category_id, tournament_id,
           tournaments!inner(*),
           tournament_categories!inner(id, name, sport)`,
        )
        .or(`player1_user_id.eq.${user.id},player2_user_id.eq.${user.id}`)
        .in("status", ["confirmada", "pendiente_admin", "pendiente_pareja"]);

      type RegJoined = {
        id: string;
        tournament_category_id: string;
        tournament_id: string;
        tournaments: Tables<"tournaments">;
        tournament_categories: Pick<Tables<"tournament_categories">, "id" | "name" | "sport">;
      };
      const allRegs = ((regs ?? []) as unknown as RegJoined[]).filter((r) => r.tournaments);
      // Filtrar por el deporte activo del switcher (tenis / pádel).
      const myRegs = allRegs.filter(
        (r) => (r.tournament_categories?.sport ?? null) === activeSport,
      );
      const STATUS_PRIORITY: Record<string, number> = {
        en_curso: 0,
        inscripciones_abiertas: 1,
      };
      const active = myRegs
        .filter((r) =>
          ["inscripciones_abiertas", "en_curso"].includes(r.tournaments.status),
        )
        .sort((a, b) => {
          const pa = STATUS_PRIORITY[a.tournaments.status] ?? 99;
          const pb = STATUS_PRIORITY[b.tournaments.status] ?? 99;
          if (pa !== pb) return pa - pb;
          return (
            new Date(a.tournaments.starts_at).getTime() -
            new Date(b.tournaments.starts_at).getTime()
          );
        });

      if (active.length === 0) {
        if (!cancel) {
          setData(null);
          setLoading(false);
        }
        return;
      }

      const reg = active[0];
      const tournament = reg.tournaments;
      const category = reg.tournament_categories;

      const myRegIds = myRegs
        .filter((r) => r.tournament_id === tournament.id)
        .map((r) => r.id);

      const [matchesRes, categoryMatchCountRes] = await Promise.all([
        supabase
          .from("tournament_matches")
          .select(
            "id, scheduled_at, played_at, status, winner_registration_id, registration_a_id, registration_b_id, court_id",
          )
          .eq("tournament_id", tournament.id)
          .or(
            `registration_a_id.in.(${myRegIds.join(",")}),registration_b_id.in.(${myRegIds.join(",")})`,
          ),
        supabase
          .from("tournament_matches")
          .select("id", { count: "exact", head: true })
          .eq("tournament_category_id", category.id),
      ]);
      const matches = matchesRes.data;
      const bracketPublished =
        (categoryMatchCountRes.count ?? 0) > 0 && (matches ?? []).length === 0;

      const ms = (matches ?? []) as Array<
        Pick<
          Tables<"tournament_matches">,
          | "id"
          | "scheduled_at"
          | "played_at"
          | "status"
          | "winner_registration_id"
          | "registration_a_id"
          | "registration_b_id"
          | "court_id"
        >
      >;

      // Fetch courts and rival registrations + profiles in parallel
      const courtIds = Array.from(
        new Set(ms.map((m) => m.court_id).filter(Boolean) as string[]),
      );
      const rivalRegIds = Array.from(
        new Set(
          ms
            .flatMap((m) => [m.registration_a_id, m.registration_b_id])
            .filter((id): id is string => !!id && !myRegIds.includes(id)),
        ),
      );

      const [courtsRes, rivalRegsRes] = await Promise.all([
        courtIds.length
          ? supabase.from("courts").select("id, name").in("id", courtIds)
          : Promise.resolve({ data: [] as { id: string; name: string }[] }),
        rivalRegIds.length
          ? supabase
              .from("tournament_registrations")
              .select("id, player1_user_id")
              .in("id", rivalRegIds)
          : Promise.resolve({ data: [] as { id: string; player1_user_id: string }[] }),
      ]);

      const rivalUserIds = (rivalRegsRes.data ?? []).map((r) => r.player1_user_id);
      const profilesRes = rivalUserIds.length
        ? await supabase
            .from("profiles_directory")
            .select("user_id, first_name, last_name")
            .in("user_id", rivalUserIds)
        : { data: [] as { user_id: string; first_name: string | null; last_name: string | null }[] };

      const courtName = new Map((courtsRes.data ?? []).map((c) => [c.id, c.name]));
      const regToUser = new Map((rivalRegsRes.data ?? []).map((r) => [r.id, r.player1_user_id]));
      const userToName = new Map(
        (profilesRes.data ?? []).map((p) => [
          p.user_id,
          `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim(),
        ]),
      );

      const rivalNameOf = (m: (typeof ms)[number]) => {
        const isA = myRegIds.includes(m.registration_a_id ?? "");
        const rivalRegId = isA ? m.registration_b_id : m.registration_a_id;
        if (!rivalRegId) return "Por definir";
        const uid = regToUser.get(rivalRegId);
        return (uid && userToName.get(uid)) || "Por definir";
      };

      const now = Date.now();
      const isPlayable = (m: (typeof ms)[number]) =>
        (m.status === "programado" || m.status === "pendiente") &&
        !!m.registration_a_id &&
        !!m.registration_b_id &&
        !!m.scheduled_at;
      const upcoming = ms
        .filter((m) => isPlayable(m) && new Date(m.scheduled_at!).getTime() >= now)
        .sort(
          (a, b) =>
            new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime(),
        )[0];
      const reportable = ms
        .filter((m) => isPlayable(m) && new Date(m.scheduled_at!).getTime() < now)
        .sort(
          (a, b) =>
            new Date(b.scheduled_at!).getTime() - new Date(a.scheduled_at!).getTime(),
        )[0];
      const lastPlayed = ms
        .filter((m) => m.status === "jugado" && m.played_at)
        .sort(
          (a, b) => new Date(b.played_at!).getTime() - new Date(a.played_at!).getTime(),
        )[0];

      const result: ActiveTournamentInfo = {
        tournament,
        category,
        registrationId: reg.id,
        bracketPublished,
        nextMatch: upcoming
          ? {
              id: upcoming.id,
              scheduled_at: upcoming.scheduled_at!,
              court_name: upcoming.court_id ? courtName.get(upcoming.court_id) ?? null : null,
              rival_name: rivalNameOf(upcoming),
            }
          : null,
        reportableMatch: reportable
          ? { id: reportable.id, scheduled_at: reportable.scheduled_at! }
          : null,
        lastResult: lastPlayed
          ? {
              id: lastPlayed.id,
              won: !!lastPlayed.winner_registration_id && myRegIds.includes(lastPlayed.winner_registration_id),
              rival_name: rivalNameOf(lastPlayed),
              played_at: lastPlayed.played_at,
            }
          : null,
      };

      if (!cancel) {
        setData(result);
        setLoading(false);
      }
    };
    load();
    return () => {
      cancel = true;
    };
  }, [user, activeSport]);

  return { data, loading };
}
