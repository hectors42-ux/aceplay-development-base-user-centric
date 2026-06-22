import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

/**
 * Cubre las variables del MatchHistorySheet que no estaban en match-history-e2e:
 *  - Filtros (Todos / Pendientes / Pirámide / Torneos / Amistosos)
 *  - Badges: needs_result, waiting_opponent, needs_confirm
 *  - Vencido (scheduled_at en el pasado)
 *  - Confirmar con error → toast + reintento
 *  - Modo público: sin chip Pendientes, sin botones de acción
 *  - Empty state
 *  - initialFilter
 */

const toastErrSpy = vi.fn();
const toastOkSpy = vi.fn();
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: toastOkSpy, error: toastErrSpy }),
}));

const USER = "user-1";
const OPP = "user-2";

let confirmShouldFail = false;

vi.mock("@/components/providers/AuthProvider", () => ({
  useAuth: () => ({ user: { id: USER } }),
}));

const PAST = new Date(Date.now() - 86400000).toISOString();
const FUTURE = new Date(Date.now() + 86400000).toISOString();

const buildHistory = () => ({
  is_self: true,
  limit: 50,
  played: [
    {
      id: "p-amistoso",
      recorded_at: "2026-04-10T15:00:00Z",
      delta: 0.05,
      level_after: 4.0,
      source: "amistoso",
      source_ref_id: null,
      opponent_id: OPP,
      score: [{ a: 6, b: 3 }],
      won: true,
    },
    {
      id: "p-torneo",
      recorded_at: "2026-04-09T15:00:00Z",
      delta: -0.07,
      level_after: 3.93,
      source: "partido_torneo",
      source_ref_id: null,
      opponent_id: OPP,
      score: [{ a: 4, b: 6 }],
      won: false,
    },
  ],
  pending_tournaments: [
    {
      match_id: "tm-1",
      scheduled_at: FUTURE,
      created_at: "2026-04-15T10:00:00Z",
      round: 1,
      category_id: "cat-1",
      category_name: "Cuadro A",
      tournament_slug: "verano",
      tournament_name: "Open Verano",
      opponent_name: "Rival Torneo",
      has_pending_proposal: false,
      needs_action: "submit",
    },
  ],
  pending_ladder: [
    {
      // needs_result, scheduled en el pasado → debe mostrar "Vencido"
      challenge_id: "ch-overdue",
      scheduled_at: PAST,
      created_at: "2026-04-05T10:00:00Z",
      status: "aceptado",
      result_proposed_by: null,
      result_proposed_at: null,
      ladder_id: "lad-1",
      ladder_name: "Pirámide A",
      opponent_id: OPP,
      opponent_name: "Rival Vencido",
      needs_action: "submit",
    },
    {
      // El usuario propuso → "Esperando rival"
      challenge_id: "ch-wait",
      scheduled_at: FUTURE,
      created_at: "2026-04-12T10:00:00Z",
      status: "resultado_propuesto",
      result_proposed_by: USER,
      result_proposed_at: "2026-04-13T10:00:00Z",
      ladder_id: "lad-1",
      ladder_name: "Pirámide A",
      opponent_id: OPP,
      opponent_name: "Rival Wait",
      needs_action: "wait",
    },
    {
      // El rival propuso → "Por confirmar"
      challenge_id: "ch-confirm",
      scheduled_at: FUTURE,
      created_at: "2026-04-12T10:00:00Z",
      status: "resultado_propuesto",
      result_proposed_by: OPP,
      result_proposed_at: "2026-04-13T10:00:00Z",
      ladder_id: "lad-1",
      ladder_name: "Pirámide A",
      opponent_id: OPP,
      opponent_name: "Rival Confirm",
      needs_action: "confirm",
    },
  ],
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: vi.fn(async (fn: string) => {
      if (fn === "user_match_history") return { data: buildHistory(), error: null };
      if (fn === "confirm_ladder_result") {
        if (confirmShouldFail) return { data: null, error: { message: "boom" } };
        return { data: null, error: null };
      }
      return { data: null, error: null };
    }),
  },
}));

const renderSheet = async (props: {
  mode?: "own" | "public";
  initialFilter?: "all" | "pending" | "tournament" | "ladder" | "friendly";
} = {}) => {
  const { MatchHistorySheet } = await import("@/components/profile/MatchHistorySheet");
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <MatchHistorySheet
          open
          onOpenChange={() => {}}
          userId={USER}
          mode={props.mode ?? "own"}
          initialFilter={props.initialFilter}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe("MatchHistorySheet — variables y estados", () => {
  beforeEach(() => {
    confirmShouldFail = false;
    toastErrSpy.mockClear();
    toastOkSpy.mockClear();
  });

  it("muestra los 3 estados Escalerilla: Falta resultado, Esperando rival, Por confirmar", async () => {
    await renderSheet();
    await waitFor(() => screen.getByText(/Historial de partidos/i));
    expect((await screen.findAllByText(/Falta resultado/i)).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/Esperando rival/i)).toBeInTheDocument();
    expect(screen.getByText(/Por confirmar/i)).toBeInTheDocument();
  });

  it("renderiza badge 'Vencido' cuando un challenge needs_result está en el pasado", async () => {
    await renderSheet();
    await waitFor(() => screen.getByText(/Historial de partidos/i));
    expect(await screen.findByLabelText(/Partido vencido/i)).toBeInTheDocument();
  });

  it("filtros: 'Escalerilla' deja solo desafíos; 'Torneos' deja solo torneo; 'Amistosos' deja solo amistoso", async () => {
    await renderSheet();
    await waitFor(() => screen.getByText(/Historial de partidos/i));

    fireEvent.click(screen.getByRole("button", { name: /^Escalerilla/ }));
    await waitFor(() => {
      expect(screen.queryByText(/Open Verano/i)).not.toBeInTheDocument();
    });
    expect(screen.getAllByText(/Pirámide A/i).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /^Torneos/ }));
    await waitFor(() => {
      expect(screen.queryByText(/Pirámide A/i)).not.toBeInTheDocument();
    });
    expect(screen.getByText(/Open Verano/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Amistosos/ }));
    await waitFor(() => {
      expect(screen.queryByText(/Open Verano/i)).not.toBeInTheDocument();
    });
    // Amistoso jugado: badge Ganaste
    expect(screen.getByText(/Ganaste/i)).toBeInTheDocument();
  });

  it("initialFilter='pending' arranca con el chip Pendientes activo", async () => {
    await renderSheet({ initialFilter: "pending" });
    await waitFor(() => screen.getByText(/Historial de partidos/i));
    // No deberían verse jugados
    expect(screen.queryByText(/Ganaste/i)).not.toBeInTheDocument();
    // Sí los pendings
    expect(screen.getAllByText(/Falta resultado/i).length).toBeGreaterThan(0);
  });

  it("modo público: no muestra chip Pendientes ni filas pending", async () => {
    await renderSheet({ mode: "public" });
    await waitFor(() => screen.getByText(/Últimos partidos/i));
    expect(screen.queryByRole("button", { name: /^Pendientes/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/Falta resultado/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Por confirmar/i)).not.toBeInTheDocument();
  });

  it("confirmar con error: muestra toast y botón cambia a Reintentar", async () => {
    confirmShouldFail = true;
    await renderSheet();
    await waitFor(() => screen.getByText(/Por confirmar/i));
    const btn = screen.getByRole("button", { name: /confirmar resultado vs rival confirm/i });
    fireEvent.click(btn);
    await waitFor(() => {
      expect(toastErrSpy).toHaveBeenCalled();
    });
    expect(
      await screen.findByRole("button", {
        name: /reintentar confirmar resultado vs rival confirm/i,
      }),
    ).toBeInTheDocument();
  });

  it("empty state cuando no hay historial", async () => {
    // Re-mock vacío
    const mod = await import("@/integrations/supabase/client");
    (mod.supabase.rpc as unknown as { mockImplementationOnce: (fn: unknown) => void }).mockImplementationOnce(
      async () => ({
        data: { is_self: true, limit: 50, played: [], pending_tournaments: [], pending_ladder: [] },
        error: null,
      }),
    );
    await renderSheet();
    await waitFor(() => screen.getByText(/Historial de partidos/i));
    expect(await screen.findByText(/Sin partidos aún/i)).toBeInTheDocument();
  });
});
