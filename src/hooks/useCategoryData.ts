import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Trophy, GitBranch } from "lucide-react";
import { createElement } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Category = Tables<"tournament_categories">;
export type Tournament = Tables<"tournaments">;
export type Registration = Tables<"tournament_registrations">;
export type Match = Tables<"tournament_matches">;
export type ResultProposal = Tables<"tournament_match_results">;
export type RescheduleRequest = Tables<"tournament_match_reschedule_requests">;
export type Court = Tables<"courts">;
export type TournamentPhase = Tables<"tournament_phases">;
export type TournamentCourt = Tables<"tournament_courts">;

export type Player = Pick<
  Tables<"profiles">,
  "user_id" | "first_name" | "last_name" | "ntrp_level" | "club_ranking"
>;

export interface CategoryBundle {
  tournament: Tournament | null;
  category: Category | null;
  registrations: Registration[];
  matches: Match[];
  players: Map<string, Player>;
  pendingResults: ResultProposal[];
  pendingReschedules: RescheduleRequest[];
  courts: Court[];
  phases: TournamentPhase[];
  dedicatedCourtIds: string[];
}

export function useCategoryBundle(categoryId: string | undefined) {
  const [bundle, setBundle] = useState<CategoryBundle>({
    tournament: null,
    category: null,
    registrations: [],
    matches: [],
    players: new Map(),
    pendingResults: [],
    pendingReschedules: [],
    courts: [],
    phases: [],
    dedicatedCourtIds: [],
  });
  const [loading, setLoading] = useState(true);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const initializedRef = useRef(false);
  const prevMatchesRef = useRef<Map<string, Match>>(new Map());

  const reload = useCallback(async () => {
    if (!categoryId) return;
    setRefreshing(true);
    const { data: cat } = await supabase
      .from("tournament_categories")
      .select("*")
      .eq("id", categoryId)
      .maybeSingle();
    if (!cat) {
      setBundle((b) => ({ ...b, category: null }));
      setLoading(false);
      setRefreshing(false);
      return;
    }
    const [
      { data: t },
      { data: regs },
      { data: mts },
      { data: results },
      { data: resch },
      { data: courts },
      { data: phases },
      { data: dedicated },
    ] = await Promise.all([
      supabase.from("tournaments").select("*").eq("id", cat.tournament_id).maybeSingle(),
      supabase
        .from("tournament_registrations")
        .select("*")
        .eq("tournament_category_id", categoryId)
        .order("registered_at"),
      supabase
        .from("tournament_matches")
        .select("*")
        .eq("tournament_category_id", categoryId)
        .order("round", { ascending: false })
        .order("bracket_position"),
      supabase
        .from("tournament_match_results")
        .select("*")
        .eq("status", "propuesto"),
      supabase
        .from("tournament_match_reschedule_requests")
        .select("*")
        .eq("status", "pendiente"),
      supabase.from("courts").select("*").eq("is_active", true).order("sort_order"),
      supabase
        .from("tournament_phases")
        .select("*")
        .eq("tournament_id", cat.tournament_id)
        .order("round"),
      supabase
        .from("tournament_courts")
        .select("court_id")
        .eq("tournament_id", cat.tournament_id),
    ]);

    const userIds = new Set<string>();
    (regs ?? []).forEach((r) => {
      userIds.add(r.player1_user_id);
      if (r.player2_user_id) userIds.add(r.player2_user_id);
    });
    let players = new Map<string, Player>();
    if (userIds.size > 0) {
      const { data: profs } = await supabase
        .from("profiles_directory")
        .select("user_id, first_name, last_name, ntrp_level, club_ranking")
        .in("user_id", Array.from(userIds));
      players = new Map((profs ?? []).map((p) => [p.user_id, p as Player]));
    }

    const matchIds = new Set((mts ?? []).map((m) => m.id));
    const newMatches = mts ?? [];
    const newRegs = regs ?? [];

    // Detectar cambios solo después de la primera carga
    if (initializedRef.current) {
      const prev = prevMatchesRef.current;
      const labelOf = (regId: string | null | undefined): string => {
        if (!regId) return "BYE";
        const r = newRegs.find((x) => x.id === regId);
        if (!r) return "Jugador";
        const p1 = players.get(r.player1_user_id);
        const n1 = p1 ? `${p1.first_name} ${p1.last_name}`.trim() : "Jugador";
        if (!r.player2_user_id) return n1;
        const p2 = players.get(r.player2_user_id);
        const n2 = p2 ? `${p2.first_name} ${p2.last_name}`.trim() : "Jugador";
        return `${n1} / ${n2}`;
      };
      const roundName = (round: number, totalRounds: number): string => {
        const fromFinal = totalRounds - round + 1;
        if (fromFinal === 1) return "Final";
        if (fromFinal === 2) return "Semifinal";
        if (fromFinal === 3) return "Cuartos";
        if (fromFinal === 4) return "Octavos";
        return `R${round}`;
      };
      const maxRound = newMatches.reduce((acc, m) => Math.max(acc, m.round), 0);

      for (const m of newMatches) {
        const before = prev.get(m.id);
        // Nuevo resultado registrado (status pasa a jugado/walkover y antes no)
        const wasFinished =
          before && (before.status === "jugado" || before.status === "walkover");
        const nowFinished = m.status === "jugado" || m.status === "walkover";
        if (before && !wasFinished && nowFinished && m.winner_registration_id) {
          const winner = labelOf(m.winner_registration_id);
          toast.success(`${roundName(m.round, maxRound)} · ${winner} avanza`, {
            description: m.walkover ? "Walkover" : m.retired ? "Retiro" : "Resultado registrado",
            icon: createElement(Trophy, { className: "h-4 w-4" }),
          });
        }
        // Avance de bracket: un match que antes no tenía rivales y ahora sí
        const beforeHadBoth = before && before.registration_a_id && before.registration_b_id;
        const nowHasBoth = m.registration_a_id && m.registration_b_id;
        if (before && !beforeHadBoth && nowHasBoth && m.status === "pendiente") {
          const a = labelOf(m.registration_a_id);
          const b = labelOf(m.registration_b_id);
          toast(`${roundName(m.round, maxRound)} definida`, {
            description: `${a} vs ${b}`,
            icon: createElement(GitBranch, { className: "h-4 w-4" }),
          });
        }
      }
    }

    prevMatchesRef.current = new Map(newMatches.map((m) => [m.id, m]));
    initializedRef.current = true;

    setBundle({
      tournament: t,
      category: cat,
      registrations: newRegs,
      matches: newMatches,
      players,
      pendingResults: (results ?? []).filter((r) => matchIds.has(r.match_id)),
      pendingReschedules: (resch ?? []).filter((r) => matchIds.has(r.match_id)),
      courts: courts ?? [],
      phases: phases ?? [],
      dedicatedCourtIds: (dedicated ?? []).map((d) => d.court_id),
    });
    setLoading(false);
    setRefreshing(false);
    setLastUpdatedAt(new Date());
  }, [categoryId]);

  useEffect(() => {
    // Resetear estado de detección al cambiar de categoría
    initializedRef.current = false;
    prevMatchesRef.current = new Map();
    setLoading(true);
    reload();
  }, [reload]);

  // Polling cada 30s mientras el torneo está activo (no finalizado/cancelado)
  const tStatus = bundle.tournament?.status;
  const cStatus = bundle.category?.status;
  const isLive =
    !!bundle.tournament &&
    tStatus !== "finalizado" &&
    tStatus !== "cancelado" &&
    tStatus !== "borrador" &&
    cStatus !== "finalizado" &&
    cStatus !== "cancelado";

  useEffect(() => {
    if (!isLive || !categoryId) return;
    let id: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (id) return;
      id = setInterval(() => {
        reload();
      }, 30000);
    };
    const stop = () => {
      if (id) {
        clearInterval(id);
        id = null;
      }
    };
    const onVis = () => {
      if (document.hidden) stop();
      else {
        // Al volver a la pestaña, refresca de inmediato y reanuda
        void reload();
        start();
      }
    };
    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [reload, categoryId, isLive]);

  return { ...bundle, loading, reload, lastUpdatedAt, refreshing, isLive };
}

export function playerName(p: Player | undefined, fallback = "—"): string {
  if (!p) return fallback;
  return `${p.first_name} ${p.last_name}`.trim() || fallback;
}

export function registrationLabel(
  reg: Registration | undefined,
  players: Map<string, Player>,
): string {
  if (!reg) return "BYE";
  const p1 = playerName(players.get(reg.player1_user_id), "Jugador 1");
  if (!reg.player2_user_id) return p1;
  const p2 = playerName(players.get(reg.player2_user_id), "Jugador 2");
  return `${p1} / ${p2}`;
}
