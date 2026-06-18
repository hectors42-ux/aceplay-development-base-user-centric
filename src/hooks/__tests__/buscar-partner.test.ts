import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { waitFor } from "@testing-library/dom";

// ---------- Mock Supabase ----------
type RpcFn = (name: string, args: unknown) => Promise<{ data: unknown; error: null }>;
const mockRpc = vi.fn<RpcFn>();
const mockFrom = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (name: string, args: unknown) => mockRpc(name, args),
    from: (table: string) => mockFrom(table),
  },
}));

vi.mock("@/components/providers/AuthProvider", () => ({
  useAuth: () => ({
    user: { id: "9337315f-3e13-4cbe-80cd-0561d4781a68" },
    profile: { tenant_id: "2cf39ca1-1585-4ccb-81cc-f1225e8ef17b" },
    roles: ["member"],
    loading: false,
  }),
}));

import { useChallengeablePlayers } from "../useChallengeablePlayers";
import { useSuggestedMatchup } from "../useSuggestedMatchup";
import { useChallengeStreak } from "../useChallengeStreak";

// Helper para construir el chain de Supabase select/eq/maybeSingle/in
const buildChain = (result: unknown, single = false) => {
  const chain: Record<string, unknown> = {};
  const passthrough = () => chain;
  chain.select = passthrough;
  chain.eq = passthrough;
  chain.in = vi.fn().mockResolvedValue({ data: result, error: null });
  chain.maybeSingle = vi.fn().mockResolvedValue({
    data: single ? result : null,
    error: null,
  });
  chain.order = passthrough;
  chain.limit = passthrough;
  return chain;
};

beforeEach(() => {
  mockRpc.mockReset();
  mockFrom.mockReset();
  // Default chain seguro para evitar unhandled rejections en re-renders tardíos
  mockFrom.mockReturnValue(buildChain(null, true));
});

describe("useChallengeablePlayers", () => {
  it("devuelve la lista ordenada por score de la RPC", async () => {
    mockRpc.mockResolvedValue({
      data: [
        {
          user_id: "u-andres",
          pos: 3,
          first_name: "Andrés",
          last_name: "Larraín",
          avatar_url: null,
          level: 4.3,
          level_diff: 0.9,
          last_played_at: "2026-04-12T16:00:00Z",
          schedule_match: true,
          rematch: false,
          cooldown_blocked: false,
          score: 78,
        },
        {
          user_id: "u-matias",
          pos: 4,
          first_name: "Matías",
          last_name: "Valdés",
          avatar_url: null,
          level: 4.55,
          level_diff: 1.15,
          last_played_at: "2026-04-16T16:00:00Z",
          schedule_match: true,
          rematch: true,
          cooldown_blocked: false,
          score: 71,
        },
      ],
      error: null,
    });

    const { result } = renderHook(() =>
      useChallengeablePlayers("aaaaaaaa-1111-4111-aaaa-aaaaaaaaaa01"),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.rows).toHaveLength(2);
    expect(result.current.rows[0].first_name).toBe("Andrés");
    expect(result.current.rows[1].rematch).toBe(true);
    expect(mockRpc).toHaveBeenCalledWith("get_challengeable_players", {
      _ladder_id: "aaaaaaaa-1111-4111-aaaa-aaaaaaaaaa01",
    });
  });

  it("retorna lista vacía si no hay ladderId", async () => {
    const { result } = renderHook(() => useChallengeablePlayers(null));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.rows).toEqual([]);
    expect(mockRpc).not.toHaveBeenCalled();
  });
});

describe("useSuggestedMatchup", () => {
  it("usa el matchup ya cacheado de la semana sin llamar la RPC", async () => {
    const cached = {
      id: "abc",
      tenant_id: "t",
      week_start: "2026-04-20",
      player_a_id: "pa",
      player_b_id: "pb",
      level_a: 4.95,
      level_b: 5.2,
      level_diff: 0.25,
      score: 75,
      reason: "Top 2",
      computed_at: "2026-04-20T10:00:00Z",
    };

    // 1ra llamada: tabla suggested_matchup_of_the_week (devuelve cached)
    // 2da llamada: profiles in() con perfiles
    mockFrom
      .mockReturnValueOnce(buildChain(cached, true))
      .mockReturnValueOnce(
        buildChain([
          { user_id: "pa", first_name: "Cris", last_name: "M", avatar_url: null },
          { user_id: "pb", first_name: "Ser", last_name: "V", avatar_url: null },
        ]),
      );

    const { result } = renderHook(() => useSuggestedMatchup());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockRpc).not.toHaveBeenCalled();
    expect(result.current.matchup?.player_a?.first_name).toBe("Cris");
    expect(result.current.matchup?.player_b?.first_name).toBe("Ser");
    expect(result.current.matchup?.level_diff).toBe(0.25);
  });

  it("computa on-demand cuando no hay cache", async () => {
    const computed = {
      id: "x",
      tenant_id: "t",
      week_start: "2026-04-20",
      player_a_id: "pa",
      player_b_id: "pb",
      level_a: 4.0,
      level_b: 4.1,
      level_diff: 0.1,
      score: 90,
      reason: "auto",
      computed_at: "now",
    };

    mockFrom
      .mockReturnValueOnce(buildChain(null, true))
      .mockReturnValueOnce(buildChain([], false));
    mockRpc.mockResolvedValueOnce({ data: computed, error: null });

    const { result } = renderHook(() => useSuggestedMatchup());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockRpc).toHaveBeenCalledWith("compute_suggested_matchup", {
      _tenant_id: "2cf39ca1-1585-4ccb-81cc-f1225e8ef17b",
    });
    expect(result.current.matchup?.score).toBe(90);
  });
});

describe("useChallengeStreak", () => {
  it("expone la racha actual y la mejor", async () => {
    mockFrom.mockReturnValueOnce(
      buildChain({ current_streak: 3, longest_streak: 5, last_week_start: "2026-04-20" }, true),
    );

    const { result } = renderHook(() => useChallengeStreak());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.current_streak).toBe(3);
    expect(result.current.longest_streak).toBe(5);
  });

  it("vuelve a ceros si el usuario no tiene fila", async () => {
    mockFrom.mockReturnValueOnce(buildChain(null, true));

    const { result } = renderHook(() => useChallengeStreak());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.current_streak).toBe(0);
    expect(result.current.longest_streak).toBe(0);
  });
});
