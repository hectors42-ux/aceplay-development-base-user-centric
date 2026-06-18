import { supabase } from "@/integrations/supabase/client";

/**
 * Telemetría liviana para AcePlay.
 * - Batchea eventos cada 5s o cuando el buffer llega a 10.
 * - Falla silenciosamente: nunca rompe la UX por un evento perdido.
 * - El tenant_id viene del perfil del usuario (lo inyecta el helper antes de enviar).
 */

type AnalyticsEvent = {
  event_name: string;
  event_props: Record<string, unknown>;
  ts: number;
};

const buffer: AnalyticsEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let cachedTenantId: string | null = null;
let cachedUserId: string | null = null;

const FLUSH_INTERVAL_MS = 5000;
const FLUSH_BATCH_SIZE = 10;

async function ensureContext(): Promise<{ tenantId: string; userId: string } | null> {
  if (cachedTenantId && cachedUserId) {
    return { tenantId: cachedTenantId, userId: cachedUserId };
  }
  const { data } = await supabase.auth.getUser();
  const user = data?.user;
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile?.tenant_id) return null;
  cachedTenantId = profile.tenant_id;
  cachedUserId = user.id;
  return { tenantId: cachedTenantId, userId: cachedUserId };
}

async function flush() {
  if (buffer.length === 0) return;
  const ctx = await ensureContext();
  if (!ctx) {
    // sin sesión, descartar buffer (no perdemos nada importante)
    buffer.length = 0;
    return;
  }
  const batch = buffer.splice(0, buffer.length);
  const rows = batch.map((e) => ({
    tenant_id: ctx.tenantId,
    user_id: ctx.userId,
    event_name: e.event_name,
    event_props: { ...e.event_props, client_ts: e.ts },
  }));
  try {
    await supabase.from("analytics_events").insert(rows);
  } catch (err) {
    // Silencioso. Logueamos en dev.
    if (import.meta.env.DEV) console.warn("[analytics] flush failed", err);
  }
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flush();
  }, FLUSH_INTERVAL_MS);
}

export function trackEvent(event_name: string, event_props: Record<string, unknown> = {}) {
  buffer.push({ event_name, event_props, ts: Date.now() });
  if (buffer.length >= FLUSH_BATCH_SIZE) {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    void flush();
    return;
  }
  scheduleFlush();
}

export function resetAnalyticsContext() {
  cachedTenantId = null;
  cachedUserId = null;
}

// Flush al cerrar/ocultar la pestaña
if (typeof window !== "undefined") {
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void flush();
  });
  window.addEventListener("beforeunload", () => {
    void flush();
  });
}
