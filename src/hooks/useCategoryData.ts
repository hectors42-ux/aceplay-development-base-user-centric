// Bundle de la categoría de torneo — CABLEADO al adaptador de lectura category_bundle
// (compone el motor en el modelo de la UI). Solo lectura; no toca el motor. Lo que el
// motor no expone (canchas, reagendas, pendientes, fases dedicadas) va vacío y la UI lo
// tolera (decisión: ocultar lo ausente).
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Category = {
  id: string;
  name: string;
  sport: string | null;
  status: string | null;
  motor: string | null;
  scheduling: string | null;
  discipline: string | null;
};
export type Tournament = { id: string; name: string; slug: string; status: string };
export type Registration = {
  id: string;
  player1_user_id: string;
  player2_user_id: string | null;
  status: string;
  seed: number | null;
};
export type Match = {
  id: string;
  registration_a_id: string | null;
  registration_b_id: string | null;
  winner_registration_id: string | null;
  status: string;
  round: number | null;
  slot: number | null;
  bracket: string | null;
  phase: string | null;
  match_id: string | null;
  scheduled_at: string | null;
  score: { a: number; b: number }[] | null;
};
export type ResultProposal = unknown;
export type RescheduleRequest = unknown;
export type Court = unknown;
export type TournamentPhase = unknown;
export type TournamentCourt = unknown;

export type Player = {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url?: string | null;
  ntrp_level?: number | null;
  club_ranking?: number | null;
};

interface BundleJson {
  tournament: Tournament | null;
  category: Category | null;
  registrations: Registration[];
  matches: Match[];
  players: Player[];
}

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
  const query = useQuery<BundleJson | null>({
    queryKey: ["category-bundle", categoryId],
    enabled: !!categoryId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("category_bundle", { _category_id: categoryId });
      if (error) throw error;
      return (data as BundleJson | null) ?? null;
    },
  });

  const players = useMemo(() => {
    const m = new Map<string, Player>();
    for (const p of query.data?.players ?? []) m.set(p.user_id, p);
    return m;
  }, [query.data]);

  return {
    tournament: query.data?.tournament ?? null,
    category: query.data?.category ?? null,
    registrations: query.data?.registrations ?? [],
    matches: query.data?.matches ?? [],
    players,
    pendingResults: [] as ResultProposal[],
    pendingReschedules: [] as RescheduleRequest[],
    courts: [] as Court[],
    phases: [] as TournamentPhase[],
    dedicatedCourtIds: [] as string[],
    loading: query.isLoading,
    reload: async () => {
      await query.refetch();
    },
    lastUpdatedAt: query.dataUpdatedAt ? new Date(query.dataUpdatedAt) : null,
    refreshing: query.isFetching && !query.isLoading,
    isLive: false,
  };
}

export function playerName(p: Player | undefined, fallback = "—"): string {
  if (!p) return fallback;
  return `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || fallback;
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
