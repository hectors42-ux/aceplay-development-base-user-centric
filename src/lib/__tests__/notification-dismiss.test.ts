import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  withRetry,
  friendlyErrorMessage,
  dedupeNotificationItems,
} from "@/lib/notification-dismiss";

/**
 * Cubre casos borde del flujo de eliminación de notificaciones:
 *   1. Notificaciones duplicadas (misma kind+ref_id) → dedupe.
 *   2. Eliminación repetida (upsert idempotente) → 2ª llamada también ok, sin reintentos.
 *   3. Permisos distintos: error RLS de otro usuario / club → mensaje "no tienes permiso".
 *   4. Reintentos: fallo transitorio recupera; fallo permanente agota intentos y loggea error.
 */

const noSleep = (_ms: number) => Promise.resolve();

describe("withRetry", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let infoSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    errorSpy.mockRestore();
    infoSpy.mockRestore();
  });

  it("éxito al primer intento — sin warnings, sin retries", async () => {
    const op = vi.fn().mockResolvedValue({ error: null, data: { ok: true } });
    const res = await withRetry(op, "test-ok", { sleep: noSleep });
    expect(res.error).toBeNull();
    expect(res.attempts).toBe(1);
    expect(op).toHaveBeenCalledTimes(1);
    expect(warnSpy).not.toHaveBeenCalled();
    expect(infoSpy).not.toHaveBeenCalled();
  });

  it("idempotencia: segunda eliminación del mismo recurso no reintenta", async () => {
    // Simula upsert idempotente: el backend devuelve éxito ambas veces.
    const op = vi.fn().mockResolvedValue({ error: null });
    const r1 = await withRetry(op, "dismiss-1", { sleep: noSleep });
    const r2 = await withRetry(op, "dismiss-2", { sleep: noSleep });
    expect(r1.attempts).toBe(1);
    expect(r2.attempts).toBe(1);
    expect(op).toHaveBeenCalledTimes(2);
  });

  it("recupera tras fallo transitorio (intento 1 falla, intento 2 ok)", async () => {
    const op = vi
      .fn()
      .mockResolvedValueOnce({ error: { message: "Failed to fetch" } })
      .mockResolvedValueOnce({ error: null });
    const res = await withRetry(op, "transient", { sleep: noSleep });
    expect(res.error).toBeNull();
    expect(res.attempts).toBe(2);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining("ok tras 2 intentos"));
  });

  it("agota intentos en fallo permanente y loggea console.error", async () => {
    const op = vi
      .fn()
      .mockResolvedValue({ error: { message: "row-level security policy violated" } });
    const res = await withRetry(op, "rls-fail", { sleep: noSleep, maxAttempts: 3 });
    expect(res.error?.message).toContain("row-level security");
    expect(res.attempts).toBe(3);
    expect(op).toHaveBeenCalledTimes(3);
    expect(warnSpy).toHaveBeenCalledTimes(3);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("falló tras 3 intentos"),
      expect.objectContaining({ message: expect.stringContaining("row-level security") }),
    );
  });

  it("captura excepciones lanzadas (network down) y reintenta", async () => {
    const op = vi
      .fn()
      .mockRejectedValueOnce(new Error("NetworkError: offline"))
      .mockResolvedValueOnce({ error: null });
    const res = await withRetry(op, "throws", { sleep: noSleep });
    expect(res.error).toBeNull();
    expect(res.attempts).toBe(2);
  });

  it("respeta maxAttempts personalizado", async () => {
    const op = vi.fn().mockResolvedValue({ error: { message: "boom" } });
    const res = await withRetry(op, "custom-max", { sleep: noSleep, maxAttempts: 5 });
    expect(res.attempts).toBe(5);
    expect(op).toHaveBeenCalledTimes(5);
  });
});

describe("friendlyErrorMessage", () => {
  it("RLS / permisos del club → mensaje claro de permiso", () => {
    expect(
      friendlyErrorMessage({
        message: 'new row violates row-level security policy for table "notification_dismissals"',
      }),
    ).toBe("No tienes permiso para eliminar esta notificación.");
    expect(friendlyErrorMessage({ message: "permission denied for table" })).toBe(
      "No tienes permiso para eliminar esta notificación.",
    );
  });

  it("sesión expirada / JWT", () => {
    expect(friendlyErrorMessage({ message: "JWT expired" })).toBe(
      "Tu sesión expiró. Vuelve a iniciar sesión.",
    );
    expect(friendlyErrorMessage({ message: "invalid auth token" })).toBe(
      "Tu sesión expiró. Vuelve a iniciar sesión.",
    );
  });

  it("red offline", () => {
    expect(friendlyErrorMessage({ message: "Failed to fetch" })).toBe(
      "Sin conexión. Revisa tu internet e inténtalo de nuevo.",
    );
    expect(friendlyErrorMessage({ message: "NetworkError when attempting to fetch" })).toBe(
      "Sin conexión. Revisa tu internet e inténtalo de nuevo.",
    );
  });

  it("fallback: devuelve el message original si no matchea ninguna categoría", () => {
    expect(friendlyErrorMessage({ message: "duplicate key value" })).toBe("duplicate key value");
  });

  it("null / undefined → mensaje genérico", () => {
    expect(friendlyErrorMessage(null)).toBe("Error desconocido. Intenta nuevamente.");
    expect(friendlyErrorMessage(undefined)).toBe("Error desconocido. Intenta nuevamente.");
  });
});

describe("dedupeNotificationItems", () => {
  it("elimina duplicados por kind+ref_id conservando el primero", () => {
    const items = [
      { kind: "ladder_challenge", ref_id: "c1", title: "A" },
      { kind: "ladder_challenge", ref_id: "c1", title: "A-dup" },
      { kind: "ladder_challenge", ref_id: "c2", title: "B" },
      { kind: "doubles_invitation", ref_id: "c1", title: "C" }, // misma ref_id, distinta kind ≠ duplicado
    ];
    const out = dedupeNotificationItems(items);
    expect(out).toHaveLength(3);
    expect(out.map((i) => i.title)).toEqual(["A", "B", "C"]);
  });

  it("lista vacía → vacío", () => {
    expect(dedupeNotificationItems([])).toEqual([]);
  });
});
