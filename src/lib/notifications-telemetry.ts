/**
 * Telemetría ligera para medir la latencia entre eventos realtime
 * (postgres_changes) y los efectos visibles para el usuario:
 *   - Render del toast
 *   - Actualización del contador (badge) en el BottomNav
 *
 * Cada evento abre un "span" identificado por un id único. Los hitos
 * (`refresh-start`, `refresh-end`, `toast-shown`, `counter-updated`)
 * se anotan con `performance.now()`. Cuando un span se cierra (o
 * expira tras 10s), se imprime un resumen agrupado en consola.
 *
 * No afecta a producción más allá de logs en consola; si se quiere
 * silenciar, basta con poner `window.__ACEPLAY_TELEMETRY__ = false`.
 */

type Source = "ladder" | "tournament";

interface Span {
  id: string;
  source: Source;
  startedAt: number;
  table?: string;
  eventType?: string;
  marks: Record<string, number>;
  closed: boolean;
  timeoutId: ReturnType<typeof setTimeout>;
}

const spans = new Map<string, Span>();
const SPAN_TTL_MS = 10_000;

function isEnabled(): boolean {
  if (typeof window === "undefined") return false;
  const flag = (window as unknown as { __ACEPLAY_TELEMETRY__?: boolean })
    .__ACEPLAY_TELEMETRY__;
  return flag !== false; // habilitado por defecto
}

function now(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function genId(source: Source): string {
  return `${source}-${Math.random().toString(36).slice(2, 8)}-${Date.now()}`;
}

function summarize(span: Span, reason: "closed" | "timeout"): void {
  if (!isEnabled()) return;
  const total = (span.marks["counter-updated"] ?? span.marks["toast-shown"] ?? now()) - span.startedAt;
  const refreshMs =
    span.marks["refresh-end"] !== undefined && span.marks["refresh-start"] !== undefined
      ? span.marks["refresh-end"] - span.marks["refresh-start"]
      : undefined;
  const toastMs =
    span.marks["toast-shown"] !== undefined
      ? span.marks["toast-shown"] - span.startedAt
      : undefined;
  const counterMs =
    span.marks["counter-updated"] !== undefined
      ? span.marks["counter-updated"] - span.startedAt
      : undefined;

  const label = `[telemetry:${span.source}] ${span.table ?? "?"} ${span.eventType ?? "?"} (${reason})`;
  // Agrupado para no ensuciar la consola
  // eslint-disable-next-line no-console
  console.groupCollapsed(
    `${label} — total ${total.toFixed(0)}ms`,
  );
  // eslint-disable-next-line no-console
  console.table({
    spanId: span.id,
    "event→toast (ms)": toastMs !== undefined ? Number(toastMs.toFixed(1)) : "—",
    "event→counter (ms)": counterMs !== undefined ? Number(counterMs.toFixed(1)) : "—",
    "RPC refresh (ms)": refreshMs !== undefined ? Number(refreshMs.toFixed(1)) : "—",
    reason,
  });
  // eslint-disable-next-line no-console
  console.groupEnd();
}

export function startSpan(
  source: Source,
  payload?: { table?: string; eventType?: string },
): string {
  const id = genId(source);
  const span: Span = {
    id,
    source,
    startedAt: now(),
    table: payload?.table,
    eventType: payload?.eventType,
    marks: {},
    closed: false,
    timeoutId: setTimeout(() => {
      const s = spans.get(id);
      if (s && !s.closed) {
        summarize(s, "timeout");
        spans.delete(id);
      }
    }, SPAN_TTL_MS),
  };
  spans.set(id, span);
  return id;
}

export function mark(spanId: string, label: string): void {
  const span = spans.get(spanId);
  if (!span) return;
  span.marks[label] = now();
}

export function endSpan(spanId: string): void {
  const span = spans.get(spanId);
  if (!span) return;
  span.closed = true;
  clearTimeout(span.timeoutId);
  summarize(span, "closed");
  spans.delete(span.id);
}

/**
 * Marca el span más antiguo aún abierto de una fuente concreta.
 * Útil para anotar efectos que ocurren en otro componente
 * (por ejemplo el render del badge en BottomNav) sin tener que
 * propagar el spanId.
 */
export function markOldestOpen(source: Source, label: string): void {
  let oldest: Span | undefined;
  for (const span of spans.values()) {
    if (span.source !== source || span.closed) continue;
    if (!oldest || span.startedAt < oldest.startedAt) oldest = span;
  }
  if (oldest) mark(oldest.id, label);
}

/**
 * Cierra el span más antiguo aún abierto de una fuente concreta.
 */
export function endOldestOpen(source: Source): void {
  let oldest: Span | undefined;
  for (const span of spans.values()) {
    if (span.source !== source || span.closed) continue;
    if (!oldest || span.startedAt < oldest.startedAt) oldest = span;
  }
  if (oldest) endSpan(oldest.id);
}
