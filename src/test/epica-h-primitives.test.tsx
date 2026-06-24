import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  CoinPill, LiveBadge, MatchScore, Steps, LeagueChip, TierGem, ArenaHero, XPMeter,
} from "@/components/arena";

const ARENA_DIR = join(process.cwd(), "src", "components", "arena");
const arenaFiles = readdirSync(ARENA_DIR).filter((f) => /\.(ts|tsx)$/.test(f));
const readArena = (f: string) => readFileSync(join(ARENA_DIR, f), "utf8");

// framer-motion's useReducedMotion lee matchMedia. Lo mockeamos.
let prefersReduced = false;
beforeAll(() => {
  window.matchMedia = ((query: string) => ({
    matches: query.includes("reduce") ? prefersReduced : false,
    media: query, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
});
afterEach(cleanup);

describe("Épica H — primitivas Arena renderizan", () => {
  it("CoinPill distingue fichas (premio) de rating (habilidad)", () => {
    render(<CoinPill kind="fichas" value={130} />);
    render(<CoinPill kind="rating" value={2088} delta={12} />);
    expect(screen.getByText("130")).toBeInTheDocument();
    expect(screen.getByText("2088")).toBeInTheDocument();
  });

  it("LiveBadge muestra EN VIVO (rol action)", () => {
    render(<LiveBadge />);
    expect(screen.getByText(/EN VIVO/i)).toBeInTheDocument();
  });

  it("MatchScore marca el ganador", () => {
    render(<MatchScore sets={[{ a: 6, b: 4 }, { a: 6, b: 3 }]} winner="a" labels={{ a: "Tú", b: "Rival" }} />);
    expect(screen.getByLabelText(/marcador/i)).toBeInTheDocument();
    expect(screen.getByText("Tú")).toBeInTheDocument();
  });

  it("Steps expone el camino de ascenso (7 pasos)", () => {
    render(<Steps current={5} />);
    expect(screen.getByLabelText(/camino de ascenso/i)).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("LeagueChip habla de LIGA/constancia, no de categoría (regla de claridad)", () => {
    const { container } = render(<LeagueChip tier="plata" division="Plata II" rank={3} />);
    expect(screen.getByText(/Liga Plata II/i)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/categor[íi]a/i);
  });

  it("ArenaHero + XPMeter + TierGem renderizan sin romper", () => {
    render(<ArenaHero nivel={5} categoria="Cuarta" sport="Pádel" />);
    render(<XPMeter value={118} max={300} />);
    render(<TierGem tier="oro" />);
    // ArenaHero ahora muestra la categoría en grande + "Nivel 5.0 / 7.0".
    expect(screen.getByText("5.0")).toBeInTheDocument();
    expect(screen.getByText(/Cuarta/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Liga Oro/i)).toBeInTheDocument();
  });

  it("con prefers-reduced-motion las primitivas siguen renderizando", () => {
    prefersReduced = true;
    render(<ArenaHero nivel={3} categoria="Sexta" />);
    render(<Steps current={2} />);
    render(<CoinPill kind="fichas" value={50} />);
    expect(screen.getByText("Sexta")).toBeInTheDocument();
    expect(screen.getByText("50")).toBeInTheDocument();
    expect(screen.getByLabelText(/camino de ascenso/i)).toBeInTheDocument();
    prefersReduced = false;
  });
});

describe("Épica H — usan tokens de rol, sin colores hardcodeados", () => {
  const ROLE_HEX = ["#C6FF1A", "#EC6E2E", "#FFC53D", "#6E86FF", "#2BD17E"];
  // Strip comments: la doc puede mencionar un hex; lo prohibido es hardcodearlo en código.
  const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  for (const file of arenaFiles) {
    const src = stripComments(readArena(file)).toUpperCase();
    it(`${file} no hardcodea ningún hex de rol`, () => {
      for (const hex of ROLE_HEX) {
        expect(src).not.toContain(hex);
      }
    });
  }

  it("respetan prefers-reduced-motion (useReducedMotion o motion-reduce)", () => {
    const motion = readArena("motion.ts");
    expect(motion).toContain("useReducedMotion");
    // LiveBadge usa la variante CSS motion-reduce.
    expect(readArena("LiveBadge.tsx")).toContain("motion-reduce");
  });
});

describe("Firewall: las primitivas son 100% visuales — no tocan ledgers ni RPCs", () => {
  const FORBIDDEN = [
    "player_ratings", "rating_history", "xp_ledger", "fichas_ledger",
    "points_ledger", "award_xp", "grant_fichas", "redeem_ficha", "supabase",
  ];
  for (const file of arenaFiles) {
    const src = readArena(file);
    for (const token of FORBIDDEN) {
      it(`${file} no referencia "${token}"`, () => expect(src).not.toContain(token));
    }
  }
});
