/**
 * Prefetch de chunks de rutas frecuentes del bottom-nav.
 * Se ejecuta durante `requestIdleCallback` para no bloquear el render inicial.
 *
 * Solo descarga el JS — no ejecuta queries — así que es seguro y barato.
 */

type IdleCb = (cb: () => void) => void;

const idle: IdleCb =
  typeof window !== "undefined" && "requestIdleCallback" in window
    ? (cb) => (window as unknown as { requestIdleCallback: (c: () => void, opts?: { timeout?: number }) => void }).requestIdleCallback(cb, { timeout: 2000 })
    : (cb) => setTimeout(cb, 800);

let prefetched = false;

export function prefetchAppRoutes() {
  if (prefetched) return;
  prefetched = true;
  idle(() => {
    // Usamos imports dinámicos: Vite emitirá los chunks separados pero el navegador
    // los cacheará para cuando el usuario navegue.
    void import("@/pages/Reservar");
    void import("@/pages/Torneos");
    void import("@/pages/Ranking");
    void import("@/pages/Perfil");
  });
}
