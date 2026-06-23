import { describe, it, expect } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { RallyAvatar, RALLY_LOOKS, RALLY_LOOK_LABEL, type RallyLook } from "@/components/avatar/RallyAvatar";

// Normaliza el markup quitando los ids únicos por instancia (useId) para poder
// comparar la ESTRUCTURA de cada look entre renders distintos.
const normalize = (html: string) =>
  html.replace(/\sid="[^"]*"/g, "").replace(/url\(#[^)]*\)/g, "url()").replace(/aria-label="[^"]*"/g, "");

describe("RallyAvatar (ilustración pro) — interfaz estable y 10 looks distintos", () => {
  it("expone exactamente los 10 looks con etiqueta", () => {
    expect(RALLY_LOOKS.length).toBe(10);
    expect(new Set(RALLY_LOOKS).size).toBe(10);
    for (const l of RALLY_LOOKS) expect(RALLY_LOOK_LABEL[l]).toBeTruthy();
  });

  it("renderiza un <svg> con aria-label correcto para cada look", () => {
    for (const look of RALLY_LOOKS) {
      const { container } = render(<RallyAvatar look={look} />);
      const svg = container.querySelector("svg");
      expect(svg).toBeTruthy();
      expect(svg!.getAttribute("aria-label")).toBe(`Rally · ${RALLY_LOOK_LABEL[look]}`);
      cleanup();
    }
  });

  it("cada uno de los 10 looks produce un dibujo DISTINTO", () => {
    const shapes = RALLY_LOOKS.map((look) => {
      const { container } = render(<RallyAvatar look={look} />);
      const html = normalize(container.querySelector("svg")!.innerHTML);
      cleanup();
      return html;
    });
    expect(new Set(shapes).size).toBe(10);
  });

  it("un look inválido cae a 'classic' sin romper", () => {
    const { container } = render(<RallyAvatar look={"inexistente" as RallyLook} />);
    expect(container.querySelector("svg")!.getAttribute("aria-label")).toBe(`Rally · ${RALLY_LOOK_LABEL.classic}`);
    cleanup();
  });
});
