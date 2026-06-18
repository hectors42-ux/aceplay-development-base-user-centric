import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

/**
 * E2E del MatchHistorySheet entre dos usuarios (Héctor #11 y demouser #6).
 *
 * Cubre:
 *  1. Render del historial propio con tres pendientes (1 needs_result torneo,
 *     1 needs_confirm Pirámide, 1 needs_result Pirámide) y los badges correctos.
 *  2. Filtro "Pendientes" oculta los partidos ya jugados.
 *  3. Click en "Confirmar" invoca `confirm_ladder_result` y refresca caches.
 *  4. Vista pública de demouser tras confirmación: el challenge aparece en `played`
 *     y desaparecen los pendings (mode="public" no muestra pendings).
 */

// ---------- Mocks ----------

const toastSpy = vi.fn();
vi.mock("sonner", () => ({
  toast: Object.assign(toastSpy, {
    success: (...a: unknown[]) => toastSpy("success", ...a),
    error: (...a: unknown[]) => toastSpy("error", ...a),
  }),
}));

const HECTOR = "hector-uuid";
const DEMO = "demo-uuid";

let currentUserId = HECTOR;

vi.mock("@/components/providers/AuthProvider", () => ({
  useAuth: () => ({ user: { id: currentUserId } }),
}));

// Estado simulado de user_match_history por usuario.
let historyByUser: Record<string, unknown> = {};

const rpcCalls: Array<{ fn: string; args: unknown }> = [];

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: vi.fn(async (fn: string, args: unknown) => {
      rpcCalls.push({ fn, args });
      if (fn === "user_match_history") {
        const uid = (args as { _user_id: string })._user_id;
        return { data: historyByUser[uid] ?? null, error: null };
      }
      if (fn === "confirm_ladder_result") {
        // Simula que el challenge confirmado pasa de pending → played.
        const cid = (args as { _challenge_id: string })._challenge_id;
        for (const uid of Object.keys(historyByUser)) {
          const h = historyByUser[uid] as {
            played: unknown[];
            pending_ladder: Array<{ challenge_id: string; opponent_name: string }>;
          };
          const idx = h.pending_ladder.findIndex((p) => p.challenge_id === cid);
          if (idx >= 0) {
            const [removed] = h.pending_ladder.splice(idx, 1);
            h.played.unshift({
              id: `played-${cid}`,
              recorded_at: new Date().toISOString(),
              delta: uid === HECTOR ? 0.12 : -0.12,
              level_after: uid === HECTOR ? 4.12 : 4.88,
              source: "desafio_ladder",
              source_ref_id: cid,
              opponent_id: uid === HECTOR ? DEMO : HECTOR,
              score: [
                { a: 6, b: 4 },
                { a: 6, b: 3 },
              ],
              won: uid === HECTOR,
            });
          }
        }
        return { data: null, error: null };
      }
      return { data: null, error: null };
    }),
  },
}));

// ---------- Helpers ----------

const baseHistory = (uid: string) => ({
  is_self: true,
  limit: 50,
  played: [
    {
      id: "old-1",
      recorded_at: "2026-01-10T15:00:00Z",
      delta: 0.05,
      level_after: 4.0,
      source: "amistoso",
      source_ref_id: null,
      opponent_id: uid === HECTOR ? DEMO : HECTOR,
      score: [{ a: 6, b: 2 }],
      won: true,
    },
  ],
  pending_tournaments: [
    {
      match_id: "tm-1",
      scheduled_at: "2026-04-20T18:00:00Z",
      created_at: "2026-04-15T10:00:00Z",
      round: 1,
      category_id: "cat-1",
      category_name: "Cuadro A",
      tournament_slug: "verano-2026",
      tournament_name: "Open Verano 2026",
      opponent_name: uid === HECTOR ? "demouser" : "Héctor Smith",
      has_pending_proposal: false,
      needs_action: "submit",
    },
  ],
  pending_ladder: [
    {
      // Challenge sin resultado aún → ambos ven "Falta resultado"
      challenge_id: "ch-needs-result",
      scheduled_at: "2026-04-20T20:00:00Z",
      created_at: "2026-04-18T10:00:00Z",
      status: "aceptado",
      result_proposed_by: null,
      result_proposed_at: null,
      ladder_id: "lad-1",
      ladder_name: "Pirámide Verano 2026",
      opponent_id: uid === HECTOR ? DEMO : HECTOR,
      opponent_name: uid === HECTOR ? "demouser" : "Héctor Smith",
      needs_action: "submit",
    },
    {
      // demouser propuso resultado → Héctor debe confirmar / demouser espera
      challenge_id: "ch-confirm",
      scheduled_at: "2026-04-19T19:00:00Z",
      created_at: "2026-04-15T10:00:00Z",
      status: "resultado_propuesto",
      result_proposed_by: DEMO,
      result_proposed_at: "2026-04-19T21:00:00Z",
      ladder_id: "lad-1",
      ladder_name: "Pirámide Verano 2026",
      opponent_id: uid === HECTOR ? DEMO : HECTOR,
      opponent_name: uid === HECTOR ? "demouser" : "Héctor Smith",
      needs_action: uid === HECTOR ? "confirm" : "wait",
    },
  ],
});

const renderSheet = async (uid: string, mode: "own" | "public" = "own") => {
  currentUserId = uid;
  const { MatchHistorySheet } = await import("@/components/profile/MatchHistorySheet");
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <MatchHistorySheet
          open
          onOpenChange={() => {}}
          userId={uid}
          mode={mode}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

// ---------- Tests ----------

describe("MatchHistorySheet — E2E entre Héctor y demouser", () => {
  beforeEach(() => {
    rpcCalls.length = 0;
    toastSpy.mockClear();
    historyByUser = {
      [HECTOR]: baseHistory(HECTOR),
      [DEMO]: baseHistory(DEMO),
    };
  });

  it("Héctor ve los 3 pendientes con los badges correctos y 1 jugado", async () => {
    await renderSheet(HECTOR, "own");

    // Espera a que el sheet renderice el contenido (no skeleton)
    await waitFor(() => {
      expect(screen.getByText(/Historial de partidos/i)).toBeInTheDocument();
    });

    // 3 pendientes (1 torneo + 2 Pirámide) → contador "3 sin resultado"
    await waitFor(() => {
      expect(screen.getByText(/3 sin resultado/i)).toBeInTheDocument();
    });

    // Badges: dos "Falta resultado" + uno "Por confirmar"
    const faltan = await screen.findAllByText(/Falta resultado/i);
    expect(faltan.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/Por confirmar/i)).toBeInTheDocument();

    // Hay al menos una fila "Listo" (el amistoso jugado)
    expect(screen.getAllByText(/Listo/i).length).toBeGreaterThanOrEqual(1);
  });

  it("filtro Pendientes oculta los jugados y deja solo los pendings", async () => {
    await renderSheet(HECTOR, "own");
    await waitFor(() => screen.getByText(/Historial de partidos/i));

    fireEvent.click(screen.getByRole("button", { name: /^Pendientes/ }));

    // Ya no debería verse el amistoso jugado (badge "Listo")
    await waitFor(() => {
      expect(screen.queryByText(/Listo/i)).not.toBeInTheDocument();
    });
    // Y siguen visibles los 3 pendientes
    expect(screen.getAllByText(/Falta resultado/i).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/Por confirmar/i)).toBeInTheDocument();
  });

  it("al confirmar resultado de Pirámide se llama al RPC y el partido pasa a Listo en el otro usuario", async () => {
    // 1) Héctor confirma
    const { unmount } = await renderSheet(HECTOR, "own");
    await waitFor(() => screen.getByText(/Por confirmar/i));

    const confirmBtn = screen.getByRole("button", { name: /confirmar resultado vs demouser/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(rpcCalls.some((c) => c.fn === "confirm_ladder_result")).toBe(true);
    });

    unmount();

    // 2) demouser ahora debería ver el challenge en jugados (no en pendings)
    await renderSheet(DEMO, "own");
    await waitFor(() => screen.getByText(/Historial de partidos/i));

    // El challenge confirmado entró a played → ahora hay 2 pendings (1 torneo + 1 Pirámide)
    await waitFor(() => {
      expect(screen.getByText(/2 sin resultado/i)).toBeInTheDocument();
    });
    // "Por confirmar" ya no debe aparecer para ninguno
    expect(screen.queryByText(/Por confirmar/i)).not.toBeInTheDocument();
    // Ni "Esperando rival"
    expect(screen.queryByText(/Esperando rival/i)).not.toBeInTheDocument();
  });

  it("vista pública de demouser no muestra pendientes ni el chip Pendientes", async () => {
    await renderSheet(DEMO, "public");
    await waitFor(() => screen.getByText(/Últimos partidos/i));

    // En modo público no se deben listar pendings
    expect(screen.queryByText(/Falta resultado/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Por confirmar/i)).not.toBeInTheDocument();
    // Y el chip "Pendientes" no debe estar disponible
    expect(screen.queryByRole("button", { name: /^Pendientes/ })).not.toBeInTheDocument();
  });
});
