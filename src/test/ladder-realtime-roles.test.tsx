import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import React from "react";

/**
 * Verifica que las suscripciones Realtime entregan eventos de la misma
 * forma a usuarios del mismo tenant pero con roles distintos
 * (member vs club_admin). El callback de `postgres_changes` se dispara
 * idénticamente y el toast/badge aparecen en ambos casos.
 *
 * Esto refleja la realidad de la RLS de `ladder_challenges`:
 *   USING (tenant_id = user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()))
 * — no discrimina por rol dentro del tenant.
 */

const toastSpy = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  toast: (args: unknown) => toastSpy(args),
  useToast: () => ({ toast: toastSpy, toasts: [] }),
}));

let currentUser: { id: string } | null = { id: "user-demo" };
vi.mock("@/components/providers/AuthProvider", () => ({
  useAuth: () => ({ user: currentUser }),
}));

let ladderCountsState = {
  challenges_received: 0,
  results_to_confirm: 0,
  scheduled_matches: 0,
  expiring_soon: 0,
  total: 0,
};
const tournamentCountsState = {
  result_proposals: 0,
  reschedule_requests: 0,
  doubles_invitations: 0,
  admin_pending_registrations: 0,
  total: 0,
};

let onChangeCallback: ((payload: unknown) => void) | null = null;

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: vi.fn(async (fnName: string) => {
      if (fnName === "ladder_pending_counts") {
        return { data: [{ ...ladderCountsState }], error: null };
      }
      if (fnName === "tournament_pending_counts") {
        return { data: [{ ...tournamentCountsState }], error: null };
      }
      if (fnName === "home_pending_actions") {
        return { data: [{ total: 0 }], error: null };
      }
      return { data: null, error: null };
    }),
    channel: vi.fn(() => {
      const channel: Record<string, unknown> = {};
      channel.on = (
        _event: string,
        _filter: unknown,
        cb: (payload: unknown) => void,
      ) => {
        onChangeCallback = cb;
        return channel;
      };
      channel.subscribe = () => channel;
      return channel;
    }),
    removeChannel: vi.fn(),
  },
}));

vi.mock("@/hooks/useTournamentNotifications", () => ({
  useTournamentNotifications: () => ({
    counts: { total: 0 },
    loading: false,
    refresh: () => undefined,
  }),
}));

import { BottomNav } from "@/components/BottomNav";

const renderBottomNav = () =>
  render(
    <MemoryRouter initialEntries={["/"]}>
      <BottomNav />
    </MemoryRouter>,
  );

const simulateChallengeArrival = async () => {
  ladderCountsState = {
    challenges_received: 1,
    results_to_confirm: 0,
    scheduled_matches: 0,
    expiring_soon: 0,
    total: 1,
  };
  await act(async () => {
    onChangeCallback?.({
      eventType: "INSERT",
      new: { id: "ch-1", challenged_user_id: currentUser.id },
    });
    await Promise.resolve();
    await Promise.resolve();
  });
};

describe("Realtime equivalente para distintos roles del mismo tenant", () => {
  beforeEach(() => {
    toastSpy.mockClear();
    onChangeCallback = null;
    ladderCountsState = {
      challenges_received: 0,
      results_to_confirm: 0,
      scheduled_matches: 0,
      expiring_soon: 0,
      total: 0,
    };
  });

  it("DemoUser (member) recibe el toast y ve el badge en < 2s", async () => {
    currentUser = { id: "user-demo" };
    renderBottomNav();
    await act(async () => { await Promise.resolve(); });

    const t0 = performance.now();
    await simulateChallengeArrival();
    await waitFor(() => expect(toastSpy).toHaveBeenCalledTimes(1));
    expect(performance.now() - t0).toBeLessThan(2000);
    await waitFor(() =>
      expect(screen.getByLabelText(/^1 acciones pendientes/)).toBeInTheDocument(),
    );
  });

  it("Héctor (club_admin + member) recibe el toast y ve el badge igual", async () => {
    currentUser = { id: "user-hector" };
    renderBottomNav();
    await act(async () => { await Promise.resolve(); });

    const t0 = performance.now();
    await simulateChallengeArrival();
    await waitFor(() => expect(toastSpy).toHaveBeenCalledTimes(1));
    expect(performance.now() - t0).toBeLessThan(2000);
    await waitFor(() =>
      expect(screen.getByLabelText(/^1 acciones pendientes/)).toBeInTheDocument(),
    );
  });

  it("usuario sin sesión no recibe toasts (early return del hook)", async () => {
    currentUser = null;
    onChangeCallback = null;
    renderBottomNav();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    // Sin user, el hook hace early-return tras el primer refresh y nunca
    // dispara toasts aunque algún canal externo emitiera un evento.
    if (onChangeCallback) {
      onChangeCallback({ eventType: "INSERT", new: { id: "x" } });
      await act(async () => { await Promise.resolve(); });
    }
    expect(toastSpy).not.toHaveBeenCalled();
  });
});
