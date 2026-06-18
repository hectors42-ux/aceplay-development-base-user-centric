import { useEffect, useLayoutEffect, useRef } from "react";
import { haptic } from "@/lib/feedback/haptic";

/**
 * FLIP reorder hook para listas/tablas que cambian de orden en realtime.
 * Captura las posiciones previas en un ref y, tras el re-render, anima
 * `transform: translateY(dy)` → 0 con cubic-bezier(.32,.72,0,1) 400ms.
 *
 * Respeta `prefers-reduced-motion`: en ese caso, no anima.
 * Si el usuario actual sube de posición, dispara haptic('light') y un flash sutil.
 */
export function useFlipReorder(
  orderedIds: string[],
  opts: { userId?: string | null; flashClass?: string } = {},
) {
  const refs = useRef<Map<string, HTMLElement>>(new Map());
  const prevRects = useRef<Map<string, DOMRect>>(new Map());
  const prevOrder = useRef<string[]>([]);

  // Captura ANTES del commit del nuevo render (useLayoutEffect corre tras DOM update,
  // pero como dependemos de orderedIds, capturamos en el effect previo guardando rects).
  // Estrategia simple: useEffect guarda rects cada render, useLayoutEffect compara con
  // la siguiente captura. Para FLIP correcto: medimos justo antes de aplicar nuevo orden
  // usando el snapshot guardado del render anterior.

  useLayoutEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const prev = prevRects.current;
    const userId = opts.userId ?? null;
    const flash = opts.flashClass ?? "flip-flash";

    if (!reduced && prev.size > 0) {
      let userMovedUp = false;
      if (userId) {
        const prevIdx = prevOrder.current.indexOf(userId);
        const nextIdx = orderedIds.indexOf(userId);
        if (prevIdx >= 0 && nextIdx >= 0 && nextIdx < prevIdx) userMovedUp = true;
      }

      orderedIds.forEach((id) => {
        const el = refs.current.get(id);
        const first = prev.get(id);
        if (!el || !first) return;
        const last = el.getBoundingClientRect();
        const dy = first.top - last.top;
        if (!dy) return;
        el.style.transform = `translateY(${dy}px)`;
        el.style.transition = "none";
        requestAnimationFrame(() => {
          el.style.transform = "";
          el.style.transition = "transform 400ms cubic-bezier(.32,.72,0,1)";
        });
      });

      if (userMovedUp) {
        haptic("light");
        const el = userId ? refs.current.get(userId) : null;
        if (el) {
          el.classList.add(flash);
          window.setTimeout(() => el.classList.remove(flash), 650);
        }
      }
    }

    // Capturar las posiciones del render actual para el próximo reorder.
    const next = new Map<string, DOMRect>();
    orderedIds.forEach((id) => {
      const el = refs.current.get(id);
      if (el) next.set(id, el.getBoundingClientRect());
    });
    prevRects.current = next;
    prevOrder.current = orderedIds.slice();
  }, [orderedIds, opts.userId, opts.flashClass]);

  // Limpieza de refs huérfanos
  useEffect(() => {
    const valid = new Set(orderedIds);
    refs.current.forEach((_, key) => {
      if (!valid.has(key)) refs.current.delete(key);
    });
  }, [orderedIds]);

  const setRef = (id: string) => (el: HTMLElement | null) => {
    if (el) refs.current.set(id, el);
    else refs.current.delete(id);
  };

  return { setRef };
}