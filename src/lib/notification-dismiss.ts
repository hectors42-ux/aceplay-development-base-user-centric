/**
 * Helpers para el flujo de eliminación de notificaciones.
 * Extraídos del NotificationCenter para poder testearlos en aislamiento.
 */

export interface DismissError {
  message: string;
  code?: string;
}

export interface RetryResult<T> {
  error: DismissError | null;
  data?: T;
  attempts: number;
}

/**
 * Ejecuta una operación con backoff exponencial.
 * Backoff por defecto: 250ms · 750ms · 2.25s (delay = baseMs · 3^(attempt-1)).
 *
 * - Si la operación retorna `{ error: null }` → éxito inmediato.
 * - Si lanza una excepción → se captura como error y se reintenta.
 * - Tras agotar `maxAttempts`, retorna el último error junto con la cuenta.
 *
 * Loggea en consola cada intento fallido y un `console.error` final si
 * todos los intentos fallan, con la `label` para facilitar el monitoreo.
 */
export async function withRetry<T>(
  op: () => PromiseLike<{ error: DismissError | null; data?: T }>,
  label: string,
  opts: { maxAttempts?: number; baseDelayMs?: number; sleep?: (ms: number) => Promise<void> } = {},
): Promise<RetryResult<T>> {
  const maxAttempts = opts.maxAttempts ?? 3;
  const baseDelayMs = opts.baseDelayMs ?? 250;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));

  let lastError: DismissError | null = null;
  let lastData: T | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await op();
      if (!res.error) {
        if (attempt > 1) {
          console.info(`[notifications] ${label} ok tras ${attempt} intentos`);
        }
        return { error: null, data: res.data, attempts: attempt };
      }
      lastError = res.error;
      lastData = res.data;
      console.warn(`[notifications] ${label} intento ${attempt}/${maxAttempts} falló`, res.error);
    } catch (err) {
      lastError = { message: err instanceof Error ? err.message : String(err) };
      console.warn(`[notifications] ${label} intento ${attempt}/${maxAttempts} excepción`, err);
    }
    if (attempt < maxAttempts) {
      await sleep(baseDelayMs * Math.pow(3, attempt - 1));
    }
  }

  console.error(`[notifications] ${label} falló tras ${maxAttempts} intentos`, lastError);
  return { error: lastError, data: lastData, attempts: maxAttempts };
}

/**
 * Traduce errores comunes de supabase a un mensaje en español
 * comprensible para el usuario final.
 */
export function friendlyErrorMessage(err: { message?: string; code?: string } | null | undefined): string {
  if (!err) return "Error desconocido. Intenta nuevamente.";
  const msg = (err.message ?? "").toLowerCase();
  if (msg.includes("network") || msg.includes("fetch") || msg.includes("failed to fetch")) {
    return "Sin conexión. Revisa tu internet e inténtalo de nuevo.";
  }
  if (msg.includes("row-level security") || msg.includes("rls") || msg.includes("permission")) {
    return "No tienes permiso para eliminar esta notificación.";
  }
  if (msg.includes("jwt") || msg.includes("token") || msg.includes("auth")) {
    return "Tu sesión expiró. Vuelve a iniciar sesión.";
  }
  return err.message ?? "No se pudo completar la acción.";
}

/**
 * Deduplica items de notificación por la clave estable `${kind}::${ref_id}`,
 * conservando la primera aparición (que viene ordenada por urgencia desde el feed).
 */
export function dedupeNotificationItems<T extends { kind: string; ref_id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const it of items) {
    const key = `${it.kind}::${it.ref_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  return out;
}
