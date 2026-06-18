import { lazy, type ComponentType } from "react";

/**
 * Wrapper de React.lazy que detecta fallos de carga de chunk (típicamente tras un
 * deploy nuevo: el HTML viejo en el navegador apunta a archivos JS con hashes
 * antiguos que ya no existen) y fuerza UNA recarga limpia de la página.
 *
 * Síntomas que cubre:
 *   - "Importing a module script failed."
 *   - "Failed to fetch dynamically imported module"
 *   - "Loading chunk N failed"
 *   - ChunkLoadError
 *
 * Usamos sessionStorage para no caer en bucle de recarga si el problema persiste.
 */
const RELOAD_FLAG = "aceplay:chunk-reload";

const isChunkLoadError = (err: unknown): boolean => {
  if (!err) return false;
  const msg = err instanceof Error ? err.message : String(err);
  return (
    /Importing a module script failed/i.test(msg) ||
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /Loading chunk [\d]+ failed/i.test(msg) ||
    /ChunkLoadError/i.test(msg) ||
    (err instanceof Error && err.name === "ChunkLoadError")
  );
};

export function lazyWithRetry<T extends ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>,
) {
  return lazy(async () => {
    try {
      const mod = await factory();
      // éxito → limpia flag para permitir un futuro auto-reload si vuelve a fallar
      try {
        sessionStorage.removeItem(RELOAD_FLAG);
      } catch {
        /* sessionStorage bloqueado: ignorar */
      }
      return mod;
    } catch (err) {
      if (!isChunkLoadError(err)) throw err;

      let alreadyReloaded = false;
      try {
        alreadyReloaded = sessionStorage.getItem(RELOAD_FLAG) === "1";
      } catch {
        /* ignorar */
      }

      if (!alreadyReloaded) {
        try {
          sessionStorage.setItem(RELOAD_FLAG, "1");
        } catch {
          /* ignorar */
        }
        console.warn(
          "[lazyWithRetry] chunk obsoleto detectado, recargando una vez para tomar el build nuevo",
          err,
        );
        // Recarga forzada sin caché
        window.location.reload();
        // Devolvemos una promesa que nunca resuelve para evitar que Suspense
        // pinte el fallback mientras el navegador recarga.
        return new Promise<never>(() => {});
      }

      // Si ya recargamos una vez y sigue fallando, propagamos el error real
      throw err;
    }
  });
}
