import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import React from "react";

/**
 * E2E: simula el envío de un desafío en una sesión paralela
 * y verifica que en la sesión del retado:
 *   - El toast "Nuevo desafío en la Pirámide" aparece en < 2s.
 *   - El badge del BottomNav (item "Ranking") se actualiza sin refresh.
 */

// ---------- Mocks ----------

const toastSpy = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  toast: (args: unknown) => toastSpy(args),
  useToast: () => ({ toast: toastSpy, toasts: [] }),
}));

const authUser = { id: "user-demo-uuid" };
vi.mock("@/components/providers/AuthProvider", () => ({
  useAuth: () => ({ user: authUser }),
}));

// Estado mutable que el RPC devuelve. Empezamos sin pendientes.
let ladderCountsState = {
  challenges_received: 0,
  results_to_confirm: 0,
  scheduled_matches: 0,
  expiring_soon: 0,
  total: 0,
};
const tournamentCountsState = {
  matches_to_accept: 0,
  results_to_confirm: 0,
  reschedule_requests: 0,
  total: 0,
};

// Captura el callback registrado por .on(...) para dispararlo manualmente
let onChangeCallback: ((payload: unknown) => void) | null = null;

vi.mock("@/integrations/supabase/client", () => {
  return {
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
  };
});

// useTournamentNotifications no es lo que probamos; lo neutralizamos
vi.mock("@/hooks/useTournamentNotifications", () => ({
  useTournamentNotifications: () => ({
    counts: { total: 0 },
    loading: false,
    refresh: () => undefined,
  }),
}));

// ---------- Test ----------

import { BottomNav } from "@/components/BottomNav";

const renderBottomNav = () =>
  render(
    <MemoryRouter initialEntries={["/"]}>
      <BottomNav />
    </MemoryRouter>,
  );

describe("Realtime: nuevo desafío en Pirámide", () => {
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

  it("dispara toast y actualiza badge del BottomNav en < 2s sin refresh", async () => {
    renderBottomNav();

    // 1) Carga inicial: el badge no se ve y aún no hay toast.
    await act(async () => {
      await Promise.resolve();
    });
    expect(toastSpy).not.toHaveBeenCalled();
    expect(
      screen.queryByLabelText(/acciones pendientes/i),
    ).not.toBeInTheDocument();

    // 2) Simulación de "otra sesión": Héctor envía el desafío → BD inserta fila →
    //    Realtime emite postgres_changes a la sesión de Demo.
    expect(onChangeCallback).not.toBeNull();
    ladderCountsState = {
      challenges_received: 1,
      results_to_confirm: 0,
      scheduled_matches: 0,
      expiring_soon: 0,
      total: 1,
    };

    const t0 = performance.now();
    await act(async () => {
      onChangeCallback?.({
        eventType: "INSERT",
        new: { id: "challenge-new", challenged_user_id: authUser.id },
      });
      // Drena microtareas para que el refresh asíncrono complete
      await Promise.resolve();
      await Promise.resolve();
    });

    // 3) Toast aparece y mide el tiempo entre evento → toast.
    await waitFor(() => expect(toastSpy).toHaveBeenCalledTimes(1));
    const elapsed = performance.now() - t0;
    expect(elapsed).toBeLessThan(2000);

    const toastArg = toastSpy.mock.calls[0][0] as {
      title: string;
      description: string;
    };
    expect(toastArg.title).toBe("Nuevo desafío en la Escalerilla");

    // 4) BottomNav muestra el badge actualizado sin refresh manual.
    await waitFor(() => {
      const badge = screen.getByLabelText("1 acciones pendientes");
      expect(badge).toBeInTheDocument();
      expect(badge.textContent).toBe("1");
    });
  });

  it("no dispara toast en la primera carga aunque haya desafíos pre-existentes", async () => {
    ladderCountsState = {
      challenges_received: 2,
      results_to_confirm: 0,
      scheduled_matches: 0,
      expiring_soon: 0,
      total: 2,
    };
    renderBottomNav();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(toastSpy).not.toHaveBeenCalled();
    // Pero el badge sí refleja el estado real
    await waitFor(() => {
      expect(screen.getByLabelText("2 acciones pendientes")).toBeInTheDocument();
    });
  });
});
