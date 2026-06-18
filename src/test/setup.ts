import "@testing-library/jest-dom";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// Polyfills usados por componentes que dependen de observadores del DOM
// (carruseles, reveal-on-scroll, charts, etc.). Necesarios en jsdom.
class IntersectionObserverPolyfill {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
class ResizeObserverPolyfill {
  observe() {}
  unobserve() {}
  disconnect() {}
}
const g = globalThis as unknown as {
  IntersectionObserver?: unknown;
  ResizeObserver?: unknown;
};
g.IntersectionObserver = g.IntersectionObserver ?? IntersectionObserverPolyfill;
g.ResizeObserver = g.ResizeObserver ?? ResizeObserverPolyfill;

// scrollTo / scrollIntoView no existen en jsdom; algunas libs (embla, radix) los invocan.
if (typeof window !== "undefined") {
  window.scrollTo = window.scrollTo ?? (() => {});
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = function () {};
  }
}
