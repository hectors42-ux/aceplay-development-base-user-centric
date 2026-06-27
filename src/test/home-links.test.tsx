import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// Polyfills (algunos componentes usan estos APIs al montar).
class IO {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
class RO {
  observe() {}
  unobserve() {}
  disconnect() {}
}
const g = globalThis as unknown as { IntersectionObserver?: unknown; ResizeObserver?: unknown };
g.IntersectionObserver = g.IntersectionObserver ?? IO;
g.ResizeObserver = g.ResizeObserver ?? RO;

/**
 * E2E de los enlaces del Home: cada CTA / link debe navegar a la ruta esperada.
 *
 * Estrategia: renderizamos el Index dentro de MemoryRouter con un componente espía
 * de ubicación; cada `Routes` adicional captura la ruta destino y la expone para
 * assertions sin re-implementar las páginas reales.
 */

// ---------- Mocks globales ----------

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

vi.mock("@/lib/prefetch-routes", () => ({ prefetchAppRoutes: vi.fn() }));

const USER_ID = "user-1";

// IMPORTANTE: referencias estables. Si devolvemos {user:{id}} nuevo en cada render,
// los useEffect(..., [user]) entran en loop infinito (ej. HeroCard).
const STABLE_USER = { id: USER_ID };
const STABLE_PROFILE = {
  first_name: "Hector",
  last_name: "Smith",
  avatar_url: null,
  dues_status: "al_dia",
};
const STABLE_AUTH = {
  user: STABLE_USER,
  profile: STABLE_PROFILE,
  isCoach: false,
};
vi.mock("@/components/providers/AuthProvider", () => ({
  useAuth: () => STABLE_AUTH,
}));

// El Home consume useClubBrand (brand.name en el footer). El test no monta el provider real,
// así que lo mockeamos con la marca por defecto, igual que AuthProvider.
vi.mock("@/components/providers/ClubBrandProvider", () => ({
  useClubBrand: () => ({
    brand: { name: "AcePlay Demo Club", logoUrl: null, primary: "", primaryGlow: "", primaryDeep: "" },
  }),
  ClubBrandProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// HeroShell consume useTheme para elegir el fondo del hero.
vi.mock("@/contexts/ThemeContext", () => ({
  useTheme: () => ({ theme: "terre-battue", setTheme: vi.fn() }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: vi.fn(async (fn: string) => {
      if (fn === "my_upcoming_bookings") {
        return {
          data: [
            {
              id: "b-1",
              starts_at: new Date(Date.now() + 86400000).toISOString(),
              ends_at: new Date(Date.now() + 90000000).toISOString(),
              court_name: "Cancha 1",
              court_surface: "arcilla",
              other_first_name: "Juan",
              other_last_name: "Perez",
              i_am_owner: true,
            },
          ],
          error: null,
        };
      }
      if (fn === "user_match_history") {
        return {
          data: {
            played: [
              {
                id: "m-1",
                recorded_at: "2026-04-10T15:00:00Z",
                delta: 0.05,
                level_after: 4.0,
                source: "amistoso",
                source_ref_id: null,
                opponent_id: "u-2",
                score: [{ a: 6, b: 3 }],
                won: true,
              },
            ],
            pending_tournaments: [],
            pending_ladder: [],
            is_self: true,
            limit: 50,
          },
          error: null,
        };
      }
      if (fn === "user_profile_summary") {
        return {
          data: {
            profile: { first_name: "Hector", last_name: "Smith", avatar_url: null },
            rating: { level: 4.0 },
            recent_matches: [
              {
                played_at: "2026-04-10T15:00:00Z",
                opponent: { id: "u-2", first_name: "Juan", last_name: "P", avatar_url: null, level: 3.8 },
                won: true,
                score: [{ a: 6, b: 3 }],
                source: "amistoso",
              },
            ],
          },
          error: null,
        };
      }
      if (fn === "match_of_the_week" || fn === "tournament_pending_actions" || fn === "ladder_pending_actions") {
        return { data: null, error: null };
      }
      return { data: null, error: null };
    }),
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    })),
    removeChannel: vi.fn(),
  },
}));

// Mocks de hooks complejos: devolvemos shape mínimo para que los componentes rendericen.
const STABLE_RATING = {
  rating: {
    level: 4.25,
    reliability: 78,
    matches_played: 12,
    last_change_delta: 0.05,
    sport: "tenis_singles",
  },
  category: "B",
  loading: false,
};
vi.mock("@/hooks/useMyRatingWithCategory", () => ({
  useMyRatingWithCategory: () => STABLE_RATING,
}));

// Estable para evitar re-renders en cascada por nueva referencia en cada render.
const STABLE_PROFILE_SUMMARY = {
  profile: { first_name: "Hector", last_name: "Smith", avatar_url: null },
  rating: { level: 4.0, category: "B" as const, last_change_delta: 0.05, reliability: 80, matches_played: 12 },
  positions: { ranking: 12, ladder: 4, ladder_status: "activo" },
  stats: { wins: 0, losses: 0, walkovers_for: 0, walkovers_against: 0, streak: 0, streak_kind: null },
  recent_matches: [
    {
      id: "rm-1",
      recorded_at: "2026-04-10T15:00:00Z",
      opponent_id: "u-2",
      opponent_name: "Juan P",
      opponent_avatar_url: null,
      opponent_level: 3.8,
      won: true,
      score_summary: "6-3",
      source: "amistoso",
      delta: 0.05,
      level_after: 4.0,
    },
  ],
};
const STABLE_PROFILE_RESULT = { data: STABLE_PROFILE_SUMMARY, loading: false };
vi.mock("@/hooks/useUserProfileSummary", () => ({
  useUserProfileSummary: () => STABLE_PROFILE_RESULT,
}));

const EMPTY_LIST_LOADING = { items: [], loading: false };
const EMPTY_COUNTS = { counts: { total: 0 }, loading: false };
const EMPTY_DATA = { data: [], loading: false };

vi.mock("@/hooks/useAnnouncements", () => ({
  useAnnouncements: () => EMPTY_LIST_LOADING,
}));
vi.mock("@/hooks/useMatchOfTheWeek", () => ({
  useMatchOfTheWeek: () => EMPTY_LIST_LOADING,
}));
vi.mock("@/hooks/useTournamentNotifications", () => ({
  useTournamentNotifications: () => EMPTY_COUNTS,
}));
vi.mock("@/hooks/useLadderNotifications", () => ({
  useLadderNotifications: () => EMPTY_COUNTS,
}));
vi.mock("@/hooks/useCoachClasses", () => ({
  useMyStudentClasses: () => EMPTY_DATA,
  useMyCoachClasses: () => EMPTY_DATA,
  useCoachUpcomingClasses: () => EMPTY_DATA,
  useClassBlocks: () => EMPTY_DATA,
}));

// Mock estable de useMatchHistory: evita re-renders en cascada cuando el sheet abre.
// Devolvemos siempre la misma referencia para que useMemo([data]) no recalcule en loop.
const STABLE_HISTORY = {
  played: [
    {
      id: "m-1",
      recorded_at: "2026-04-10T15:00:00Z",
      delta: 0.05,
      level_after: 4.0,
      source: "amistoso",
      source_ref_id: null,
      opponent_id: "u-2",
      score: [{ a: 6, b: 3 }],
      won: true,
    },
  ],
  pending_tournaments: [],
  pending_ladder: [],
  is_self: true,
  limit: 50,
};
vi.mock("@/hooks/useMatchHistory", () => ({
  useMatchHistory: () => ({ data: STABLE_HISTORY, isLoading: false }),
}));

// Mock liviano del Sheet: en jsdom, los Portals + focus-traps + Embla carousel
// renderizados dentro del SheetContent provocan re-render storms que bloquean
// este test. La estructura interna del sheet se prueba en
// match-history-variants.test.tsx (sin Embla anidado). Aquí solo validamos que
// el botón "Ver historial" abre el sheet.
// El home monta widgets de economía/sponsor (XP/Liga/Racha/Fichas/lockup) con
// varios useQuery async + framer-motion: pesados e irrelevantes para los tests
// de NAVEGACIÓN. Los mockeamos a null para un render rápido y determinístico
// (mismo criterio que MatchHistorySheet).
vi.mock("@/components/home/EconomyStrip", () => ({ EconomyStrip: () => null }));
vi.mock("@/components/SponsorLockup", () => ({ SponsorLockup: () => null }));

vi.mock("@/components/profile/MatchHistorySheet", () => ({
  MatchHistorySheet: ({ open }: { open: boolean }) =>
    open ? (
      <div role="dialog" aria-label="Historial de partidos">
        Historial de partidos
      </div>
    ) : null,
}));

// ---------- Helpers ----------

const RouteSpy = ({ label }: { label: string }) => {
  const loc = useLocation();
  return <div data-testid={`route-${label}`}>{loc.pathname + loc.search}</div>;
};

const renderHome = async () => {
  const Index = (await import("@/pages/Index")).default;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/mis-reservas" element={<RouteSpy label="mis-reservas" />} />
          <Route path="/reservar" element={<RouteSpy label="reservar" />} />
          <Route path="/torneos" element={<RouteSpy label="torneos" />} />
          <Route path="/ranking" element={<RouteSpy label="ranking" />} />
          <Route path="/cancha" element={<RouteSpy label="cancha" />} />
          <Route path="/perfil" element={<RouteSpy label="perfil" />} />
          <Route path="/clases" element={<RouteSpy label="clases" />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

// ---------- Tests ----------

describe("Home — enlaces y navegación", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // QUARANTINE: el hero de "próxima reserva" depende del módulo de reservas, hoy
  // DORMIDO (src/config/modules.ts). HeroRouter ya no consulta my_upcoming_bookings.
  // Re-activar al despertar reservas.
  it.skip("HeroCard 'Ver detalle' navega a /mis-reservas cuando hay próxima reserva", async () => {
    await renderHome();
    // El aria-label vive en el <Button> dentro del <Link to="/mis-reservas">.
    // Buscamos por el botón y subimos al Link más cercano.
    const btn = await screen.findByRole("button", { name: /ver mis reservas/i });
    const link = btn.closest("a") as HTMLAnchorElement;
    expect(link).toHaveAttribute("href", "/mis-reservas");
    fireEvent.click(link);
    await waitFor(() => {
      expect(screen.getByTestId("route-mis-reservas")).toHaveTextContent("/mis-reservas");
    });
  });

  // QUARANTINE: depende de la feature de reservas (useMyUpcomingBookings) aún en stub
  // tras la migración al core. Re-activar al portar reservas.
  it.skip("Link 'Mis próximas reservas' navega a /mis-reservas cuando N>0", async () => {
    await renderHome();
    const link = await screen.findByRole("link", { name: /ver mis próximas reservas/i });
    expect(link).toHaveAttribute("href", "/mis-reservas");
  });

  // Rediseño del Inicio (Épica M): el hero de identidad + ascenso enruta a /cancha
  // (tab Progreso), no a /perfil. El Inicio resume y enruta a Cancha.
  it("El hero de identidad + ascenso navega a /cancha", async () => {
    await renderHome();
    const heroLink = await screen.findByRole("link", { name: /cancha · progreso/i });
    expect(heroLink).toHaveAttribute("href", "/cancha");
  });

  it("El acceso a Cancha (Competir, ahora secundario) navega a /cancha", async () => {
    await renderHome();
    // Rediseño "Te toca": Competir pasó a ser una puerta discreta al hub.
    const competir = await screen.findByText(/ir a cancha · todo lo competitivo/i);
    const link = competir.closest("a") as HTMLAnchorElement;
    expect(link).toHaveAttribute("href", "/cancha");
    // Los CTA hermanos del Inicio antiguo ya no existen como acciones primarias.
    expect(screen.queryByText("¿Qué quieres hacer hoy?")).toBeNull();
  });

  it("BottomNav: cada tab apunta a su ruta", async () => {
    await renderHome();
    const nav = await screen.findByRole("navigation", { name: /navegación principal/i });
    const links = nav.querySelectorAll("a");
    const hrefs = Array.from(links).map((a) => a.getAttribute("href"));
    expect(hrefs).toContain("/");
    // "Reservar" es un módulo dormido → ya no está en el bottom-nav.
    expect(hrefs).not.toContain("/reservar");
    // Nav unificada: Inicio · Descubrir · Desafío(/cancha) · Espacios · Perfil.
    // (Épica M: el FAB Desafío ahora abre el hub /cancha, que absorbe /ranking.)
    expect(hrefs).toContain("/descubrir");
    expect(hrefs).toContain("/cancha");
    expect(hrefs).toContain("/espacios");
    expect(hrefs).toContain("/perfil");
  });

  // El bloque de "pulso ligero" (racha · liga · XP) enruta a /cancha (tab Subir).
  it("El pulso ligero (racha/liga/XP) navega a /cancha", async () => {
    await renderHome();
    const pulse = await screen.findByRole("link", { name: /cancha · subir/i });
    expect(pulse).toHaveAttribute("href", "/cancha");
  });
});
