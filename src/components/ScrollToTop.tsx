import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { trackEvent } from "@/lib/analytics";

/**
 * Garantiza que cada navegación entre rutas comience en el tope de la página.
 * Si la URL incluye un hash (#seccion), respeta ese anchor y deja que el
 * navegador haga scroll al elemento correspondiente.
 *
 * También dispara el evento de telemetría `screen_viewed` con el pathname.
 */
const ScrollToTop = () => {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    // Telemetría: registra navegación (no bloqueante)
    trackEvent("screen_viewed", { pathname });

    if (hash) {
      const id = hash.replace("#", "");
      requestAnimationFrame(() => {
        const el = document.getElementById(id);
        if (el) {
          el.scrollIntoView({ behavior: "auto", block: "start" });
        } else {
          window.scrollTo({ top: 0, left: 0, behavior: "auto" });
        }
      });
      return;
    }
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname, hash]);

  return null;
};

export default ScrollToTop;
