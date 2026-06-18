import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import React from "react";

/**
 * Verifica que al borrar una notificación persistente de tipo
 * "challenge_expired" desde el NotificationCenter:
 *   - se llama a supabase.from("user_notifications")
 *   - se aplica .delete().eq("kind", kind).eq("ref_id", refId)
 *   - se refresca el feed después
 */

const toastSpy = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  toast: (args: unknown) => toastSpy(args),
  useToast: () => ({ toast: toastSpy, toasts: [] }),
}));

vi.mock("@/components/providers/AuthProvider", () => ({
  useAuth: () => ({ user: { id: "user-demo-uuid" } }),
}));

const expiredItem = {
  kind: "challenge_expired",
  ref_id: "challenge-123",
  title: "Desafío expirado",
  description: "Tu desafío venció",
  link: "/ranking?tab=piramide",
  created_at: new Date().toISOString(),
};

const eqSpy = vi.fn();
const deleteSpy = vi.fn();
const fromSpy = vi.fn();

let rpcCalls = 0;

vi.mock("@/integrations/supabase/client", () => {
  return {
    supabase: {
      rpc: vi.fn(async (fn: string) => {
        if (fn === "notifications_feed") {
          rpcCalls += 1;
          return { data: [expiredItem], error: null };
        }
        return { data: null, error: null };
      }),
      channel: vi.fn(() => {
        const ch: Record<string, unknown> = {};
        ch.on = vi.fn(() => ch);
        ch.subscribe = vi.fn(() => ch);
        return ch;
      }),
      removeChannel: vi.fn(),
      from: (table: string) => {
        fromSpy(table);
        const builder: Record<string, unknown> = {};
        builder.delete = vi.fn(() => {
          deleteSpy();
          return builder;
        });
        builder.eq = vi.fn((col: string, val: string) => {
          eqSpy(col, val);
          // Resolver al final de la cadena (.eq().eq() => promesa-like)
          const p: Record<string, unknown> = {
            then: (resolve: (v: unknown) => void) =>
              resolve({ error: null }),
            eq: builder.eq,
          };
          return p;
        });
        return builder;
      },
    },
  };
});

import { NotificationCenter } from "@/components/NotificationCenter";

describe("NotificationCenter — borrar challenge_expired", () => {
  beforeEach(() => {
    rpcCalls = 0;
    eqSpy.mockClear();
    deleteSpy.mockClear();
    fromSpy.mockClear();
    toastSpy.mockClear();
  });

  it("borra por kind y ref_id desde user_notifications y refresca", async () => {
    render(
      <MemoryRouter>
        <NotificationCenter />
      </MemoryRouter>,
    );

    // Espera carga inicial
    await waitFor(() => expect(rpcCalls).toBeGreaterThan(0));

    // Abre popover
    const trigger = screen.getByRole("button", { name: /Notificaciones/i });
    fireEvent.click(trigger);

    // Botón de descartar (aria-label "Descartar" o ícono X dentro del item)
    const dismissBtn = await screen.findByRole("button", {
      name: /descartar|borrar|cerrar/i,
    });
    fireEvent.click(dismissBtn);

    await waitFor(() => expect(deleteSpy).toHaveBeenCalledTimes(1));

    expect(fromSpy).toHaveBeenCalledWith("user_notifications");
    expect(eqSpy).toHaveBeenCalledWith("kind", "challenge_expired");
    expect(eqSpy).toHaveBeenCalledWith("ref_id", "challenge-123");

    // Después de borrar se llama refresh -> rpc notifications_feed otra vez
    await waitFor(() => expect(rpcCalls).toBeGreaterThanOrEqual(2));
  });
});
