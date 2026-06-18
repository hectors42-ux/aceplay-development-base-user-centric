/**
 * Verifica la prioridad local/remoto del ThemeContext:
 *  - Recargar página: localStorage manda; el <html> queda con el tema/modo guardado.
 *  - Sesión nueva sin cambios locales: PULL desde profiles → adopta valores remotos.
 *  - Cambio local + login: dirty=1 → PUSH local → profiles (gana lo local).
 */
import { act, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  THEME_DIRTY_KEY,
  THEME_MODE_STORAGE_KEY,
  THEME_STORAGE_KEY,
} from "@/lib/themes";

// ---- Mock supabase client ----
type Listener = (evt: string, session: { user: { id: string } } | null) => void;
const listeners: Listener[] = [];
const updateMock = vi.fn();
let getUserMock = vi.fn();
let selectSingleMock = vi.fn();

vi.mock("@/integrations/supabase/client", () => {
  const fromBuilder = () => ({
    update: (patch: unknown) => {
      updateMock(patch);
      return { eq: vi.fn().mockResolvedValue({ error: null }) };
    },
    select: () => ({
      eq: () => ({ maybeSingle: () => selectSingleMock() }),
    }),
  });
  return {
    supabase: {
      auth: {
        getUser: () => getUserMock(),
        onAuthStateChange: (cb: Listener) => {
          listeners.push(cb);
          return { data: { subscription: { unsubscribe: () => {} } } };
        },
      },
      from: () => fromBuilder(),
    },
  };
});

const triggerAuth = (user: { id: string } | null) =>
  act(async () => {
    listeners.forEach((l) => l("SIGNED_IN", user ? { user } : null));
    await Promise.resolve();
  });

beforeEach(() => {
  localStorage.clear();
  listeners.length = 0;
  updateMock.mockReset();
  getUserMock = vi.fn().mockResolvedValue({ data: { user: null } });
  selectSingleMock = vi.fn().mockResolvedValue({ data: null, error: null });
  document.documentElement.className = "";
});

afterEach(() => {
  vi.clearAllMocks();
});

const mountProvider = async () => {
  const { ThemeProvider } = await import("@/contexts/ThemeContext");
  return render(<ThemeProvider><div /></ThemeProvider>);
};

describe("ThemeContext persistence", () => {
  it("aplica el tema/modo guardados en localStorage al montar (simula recarga)", async () => {
    localStorage.setItem(THEME_STORAGE_KEY, "us-open");
    localStorage.setItem(THEME_MODE_STORAGE_KEY, "dark");

    await mountProvider();

    expect(document.documentElement.classList.contains("theme-us-open")).toBe(true);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("aplica el tema wimbledon guardado en localStorage al montar", async () => {
    localStorage.setItem(THEME_STORAGE_KEY, "wimbledon");
    localStorage.setItem(THEME_MODE_STORAGE_KEY, "light");

    await mountProvider();

    expect(document.documentElement.classList.contains("theme-wimbledon")).toBe(true);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("migra el valor legacy `etat-francais` en localStorage a `us-open`", async () => {
    localStorage.setItem(THEME_STORAGE_KEY, "etat-francais");
    localStorage.setItem(THEME_MODE_STORAGE_KEY, "light");

    await mountProvider();

    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("us-open");
    expect(document.documentElement.classList.contains("theme-us-open")).toBe(true);
    expect(document.documentElement.classList.contains("theme-etat-francais")).toBe(false);
  });

  it("PULL: al iniciar sesión sin cambios locales, adopta theme/theme_mode desde profiles", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
    selectSingleMock.mockResolvedValue({
      data: { theme: "wimbledon", theme_mode: "dark" },
      error: null,
    });

    await mountProvider();
    await triggerAuth({ id: "u1" });

    await waitFor(() => {
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("wimbledon");
      expect(localStorage.getItem(THEME_MODE_STORAGE_KEY)).toBe("dark");
      expect(document.documentElement.classList.contains("theme-wimbledon")).toBe(true);
      expect(document.documentElement.classList.contains("dark")).toBe(true);
    });
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("PUSH: si hay cambios locales (dirty=1), envía local → profiles y limpia el flag", async () => {
    localStorage.setItem(THEME_STORAGE_KEY, "us-open");
    localStorage.setItem(THEME_MODE_STORAGE_KEY, "dark");
    localStorage.setItem(THEME_DIRTY_KEY, "1");
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });

    await mountProvider();
    await triggerAuth({ id: "u1" });

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith({
        theme: "us-open",
        theme_mode: "dark",
      });
      expect(localStorage.getItem(THEME_DIRTY_KEY)).toBeNull();
    });
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("us-open");
    expect(localStorage.getItem(THEME_MODE_STORAGE_KEY)).toBe("dark");
  });
});
