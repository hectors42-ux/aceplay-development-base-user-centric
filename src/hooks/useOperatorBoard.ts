import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type Match = Tables<"tournament_matches">;
type Round = Tables<"americano_rounds">;
type Category = Tables<"tournament_categories">;
type Tournament = Tables<"tournaments">;
type Court = Tables<"courts">;

export type OperatorPlayer = {
  user_id: string;
  display_name: string;
  first_name: string;
  last_name: string;
};

export type CourtMatchView = {
  match: Match;
  liveStatus: "calentando" | "en_juego" | "cerrado";
  courtLabel: string;
  sideA: OperatorPlayer[];
  sideB: OperatorPlayer[];
};

export type OperatorRoundView = {
  round: Round;
  category: Category;
  courts: CourtMatchView[];
  totalMatches: number;
  closedMatches: number;
  allClosed: boolean;
};

export type OperatorBoardState = {
  tournament: Tournament | null;
  rounds: OperatorRoundView[];
  loading: boolean;
  reload: () => Promise<void>;
};

function playerLabel(ids: string[] | null | undefined, players: Map<string, OperatorPlayer>): OperatorPlayer[] {
  if (!ids) return [];
  return ids.map(
    (id) => players.get(id) ?? { user_id: id, display_name: "Jugador", first_name: "Jugador", last_name: "" },
  );
}

export function useOperatorBoard(slug: string | undefined) {
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [courts, setCourts] = useState<Court[]>([]);
  const [players, setPlayers] = useState<Map<string, OperatorPlayer>>(new Map());
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!slug) return;
    const { data: t } = await supabase
      .from("tournaments")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();
    if (!t) {
      setTournament(null);
      setLoading(false);
      return;
    }
    setTournament(t as Tournament);

    const [{ data: cats }, { data: rds }, { data: mts }, { data: crts }] = await Promise.all([
      supabase.from("tournament_categories").select("*").eq("tournament_id", t.id),
      supabase
        .from("americano_rounds")
        .select("*, tournament_categories!inner(tournament_id)")
        .eq("tournament_categories.tournament_id", t.id)
        .order("round_number", { ascending: false }),
      supabase
        .from("tournament_matches")
        .select("*")
        .eq("tournament_id", t.id)
        .eq("phase", "americano"),
      supabase.from("courts").select("*").eq("is_active", true).order("sort_order"),
    ]);

    setCategories((cats ?? []) as Category[]);
    setRounds((rds ?? []) as Round[]);
    setMatches((mts ?? []) as Match[]);
    setCourts((crts ?? []) as Court[]);

    const userIds = new Set<string>();
    (mts ?? []).forEach((m) => {
      ((m as Match).side_a_user_ids ?? []).forEach((id) => userIds.add(id));
      ((m as Match).side_b_user_ids ?? []).forEach((id) => userIds.add(id));
    });
    if (userIds.size > 0) {
      const { data: profs } = await supabase
        .from("profiles_directory")
        .select("user_id, first_name, last_name")
        .in("user_id", Array.from(userIds));
      const map = new Map<string, OperatorPlayer>();
      (profs ?? []).forEach((p) => {
        const row = p as { user_id: string; first_name: string | null; last_name: string | null };
        const fn = row.first_name ?? "";
        const ln = row.last_name ?? "";
        map.set(row.user_id, {
          user_id: row.user_id,
          first_name: fn,
          last_name: ln,
          display_name: `${fn} ${ln}`.trim() || "Jugador",
        });
      });
      setPlayers(map);
    } else {
      setPlayers(new Map());
    }
    setLoading(false);
  }, [slug]);

  useEffect(() => {
    setLoading(true);
    void reload();
  }, [reload]);

  // Realtime: cuando cambia cualquier match del torneo, recargamos.
  useEffect(() => {
    if (!tournament?.id) return;
    const tid = tournament.id;
    // Sufijo random: evita el conflicto "channel already exists" en
    // StrictMode / remounts, que dejaba el tablero sin updates en vivo.
    const suffix = Math.random().toString(36).slice(2);
    const channel = supabase
      .channel(`operator_board:${tid}:${suffix}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tournament_matches", filter: `tournament_id=eq.${tid}` },
        () => {
          void reload();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "americano_rounds" },
        () => {
          void reload();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
    // Dependemos solo de tournament.id: reload() recrea `tournament` con
    // ref nueva en cada fetch, lo que antes resuscribía el canal en cada
    // realtime tick.
  }, [tournament?.id, reload]);

  const board: OperatorRoundView[] = useMemo(() => {
    const courtMap = new Map(courts.map((c) => [c.id, c]));
    const catMap = new Map(categories.map((c) => [c.id, c]));
    // Group by round id
    const byRound = new Map<string, Match[]>();
    matches.forEach((m) => {
      const rid = m.americano_round_id;
      if (!rid) return;
      const arr = byRound.get(rid) ?? [];
      arr.push(m);
      byRound.set(rid, arr);
    });

    const views: OperatorRoundView[] = [];
    rounds.forEach((r) => {
      const cat = catMap.get(r.tournament_category_id);
      if (!cat) return;
      if (r.status === "finalizada") return; // hide finished rounds from the live board
      const mts = (byRound.get(r.id) ?? []).slice().sort((a, b) => a.bracket_position - b.bracket_position);
      const courtsView: CourtMatchView[] = mts.map((m) => {
        const isClosed = m.status === "jugado" || m.status === "walkover";
        const liveStatus: CourtMatchView["liveStatus"] = isClosed
          ? "cerrado"
          : m.status === "programado"
            ? "en_juego"
            : "calentando";
        const court = m.court_id ? courtMap.get(m.court_id) : null;
        const courtLabel = court?.name ?? `Mesa ${m.bracket_position}`;
        return {
          match: m,
          liveStatus,
          courtLabel,
          sideA: playerLabel(m.side_a_user_ids, players),
          sideB: playerLabel(m.side_b_user_ids, players),
        };
      });
      const closed = courtsView.filter((c) => c.liveStatus === "cerrado").length;
      views.push({
        round: r,
        category: cat,
        courts: courtsView,
        totalMatches: courtsView.length,
        closedMatches: closed,
        allClosed: courtsView.length > 0 && closed === courtsView.length,
      });
    });
    return views;
  }, [rounds, matches, courts, categories, players]);

  return { tournament, rounds: board, loading, reload, allCategories: categories, players } as OperatorBoardState & {
    allCategories: Category[];
    players: Map<string, OperatorPlayer>;
  };
}