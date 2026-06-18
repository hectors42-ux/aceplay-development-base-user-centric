import { useEffect } from "react";

/**
 * Aplica la clase `is-visible` a todos los elementos con `.reveal`
 * cuando entran en viewport. Usado por el landing público.
 *
 * Stagger: si varios `.reveal` comparten el mismo padre directo, se aplica
 * un retardo escalonado (60ms por hermano, máx 360ms) para que la animación
 * cascade en grids/listas.
 */
export const useRevealOnScroll = () => {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>(".reveal"));

    // Calcular stagger por padre
    const groups = new Map<HTMLElement, HTMLElement[]>();
    els.forEach((el) => {
      const parent = el.parentElement;
      if (!parent) return;
      if (!groups.has(parent)) groups.set(parent, []);
      groups.get(parent)!.push(el);
    });
    groups.forEach((children) => {
      if (children.length < 2) return;
      children.forEach((child, i) => {
        if (!child.style.getPropertyValue("--reveal-delay")) {
          child.style.setProperty("--reveal-delay", `${Math.min(i * 60, 360)}ms`);
        }
      });
    });

    if (!("IntersectionObserver" in window)) {
      els.forEach((el) => el.classList.add("is-visible"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
};
