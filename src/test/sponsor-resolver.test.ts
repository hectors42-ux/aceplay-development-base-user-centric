import { describe, it, expect } from "vitest";
import { resolveSponsor, currentWindowKey, type SponsorCandidate } from "@/lib/sponsor";

const c = (over: Partial<SponsorCandidate>): SponsorCandidate => ({
  placement_id: "p", brand_id: "b", brand_name: "X", logo_url: null, hero_url: null,
  slot: "default", priority: 0, paid_priority: false, weight: 1, ...over,
});

describe("resolveSponsor — prioridad pagada > prioridad > weight > rotación", () => {
  it("vacío → null", () => {
    expect(resolveSponsor([], 0)).toBeNull();
  });

  it("la prioridad PAGADA gana aunque tenga menos weight", () => {
    const paid = c({ placement_id: "paid", brand_name: "Paid", paid_priority: true, weight: 1 });
    const heavy = c({ placement_id: "heavy", brand_name: "Heavy", paid_priority: false, weight: 99 });
    expect(resolveSponsor([heavy, paid], 0).brand_name).toBe("Paid");
  });

  it("entre no-pagados, gana el de mayor weight", () => {
    const a = c({ placement_id: "a", brand_name: "A", weight: 5 });
    const b = c({ placement_id: "b", brand_name: "B", weight: 8 });
    expect(resolveSponsor([a, b], 0).brand_name).toBe("B");
  });

  it("rotación estable por ventana entre EMPATADOS (mismo paid/priority/weight)", () => {
    const x = c({ placement_id: "x1", brand_name: "X", weight: 5 });
    const y = c({ placement_id: "y2", brand_name: "Y", weight: 5 });
    // Orden estable por placement_id: [x1, y2]. windowKey par→x, impar→y.
    expect(resolveSponsor([y, x], 0).brand_name).toBe("X");
    expect(resolveSponsor([y, x], 1).brand_name).toBe("Y");
    expect(resolveSponsor([y, x], 2).brand_name).toBe("X");
    // Determinístico: misma ventana → mismo ganador, sin importar el orden de entrada.
    expect(resolveSponsor([x, y], 1).brand_name).toBe("Y");
    expect(resolveSponsor([y, x], 1).brand_name).toBe("Y");
  });

  it("currentWindowKey es estable dentro de la semana y avanza entre semanas", () => {
    const base = Date.UTC(2026, 0, 1, 12, 0, 0);
    expect(currentWindowKey(base)).toBe(currentWindowKey(base + 6 * 24 * 3600 * 1000 - 1));
    expect(currentWindowKey(base + 7 * 24 * 3600 * 1000)).toBe(currentWindowKey(base) + 1);
  });
});
