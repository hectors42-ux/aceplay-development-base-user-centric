import { useEffect, useState } from "react";

/**
 * Devuelve true cuando el viewport es "corto" (mobile bajo) y conviene
 * activar un modo compacto para que el contenido entre sin scroll.
 * Por defecto: alto <= 740px o ancho < 380px.
 */
export function useCompactViewport(maxHeight = 740, maxWidth = 380) {
  const [compact, setCompact] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.innerHeight <= maxHeight || window.innerWidth <= maxWidth;
  });

  useEffect(() => {
    const update = () => {
      setCompact(window.innerHeight <= maxHeight || window.innerWidth <= maxWidth);
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, [maxHeight, maxWidth]);

  return compact;
}
