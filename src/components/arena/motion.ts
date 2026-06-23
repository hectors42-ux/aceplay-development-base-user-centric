import { useReducedMotion, type Transition } from "framer-motion";

/**
 * Microinteracciones Arena que respetan `prefers-reduced-motion`.
 * Cuando el usuario pide menos movimiento, los reveals/pops se degradan a
 * estados finales sin animación (la UI sigue 100% usable).
 */
export function useArenaMotion() {
  const reduced = useReducedMotion();

  const reveal = reduced
    ? { initial: false as const, animate: { opacity: 1 } }
    : {
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.4, ease: [0.32, 0.72, 0, 1] as const },
      };

  const pop = reduced
    ? {}
    : { whileTap: { scale: 0.96 }, whileHover: { scale: 1.03 } };

  return { reduced, reveal, pop };
}

export const springy: Transition = { type: "spring", stiffness: 380, damping: 26 };
