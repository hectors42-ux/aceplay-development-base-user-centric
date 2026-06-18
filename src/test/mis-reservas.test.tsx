import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

/**
 * E2E de la página /mis-reservas.
 * Cubre: lista, empty state, error, owner vs invitado, calendario, navegación.
 */

const toastOkSpy = vi.fn();
const toastErrSpy = vi.fn();
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: toastOkSpy, error: toastErrSpy }),
}));

const downloadIcsSpy = vi.fn();
vi.mock("@/lib/ics", () => ({
  downloadIcs: (...args: unknown[]) => downloadIcsSpy(...args),
}));

vi.mock("@/components/providers/AuthProvider", () => ({
  useAuth: () => ({ user: { id: "u-1" } }),
}));

vi.mock("@/hooks/use-breakpoint", () => ({
  useIsDesktop: () => false,
}));

vi.mock("@/hooks/useTournamentNotifications", () => ({
  useTournamentNotifications: () => ({ counts: { total: 0 }, loading: false }),
}));
vi.mock("@/hooks/useLadderNotifications", () => ({
  useLadderNotifications: () => ({ counts: { total: 0 }, loading: false }),
}));

let bookingsPayload: unknown = [];
let bookingsError: { message: string } | null = null;
let cancelShouldFail = false;

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: vi.fn(async (fn: string) => {
      if (fn === "my_upcoming_bookings") {
        if (bookingsError) return { data: null, error: bookingsError };
        return { data: bookingsPayload, error: null };
      }
      if (fn === "cancel_booking") {
        if (cancelShouldFail) return { data: null, error: { message: "no se pudo" } };
        return { data: null, error: null };
      }
      return { data: null, error: null };
    }),
  },
}));

const FUTURE = new Date(Date.now() + 86400000).toISOString();
const FUTURE2 = new Date(Date.now() + 90000000).toISOString();

const sampleBookings = [
  {
    id: "b-1",
    starts_at: FUTURE,
    ends_at: FUTURE2,
    court_name: "Cancha 1",
    court_surface: "arcilla",
    other_first_name: "Juan",
    other_last_name: "Perez",
    i_am_owner: true,
  },
  {
    id: "b-2",
    starts_at: FUTURE,
    ends_at: FUTURE2,
    court_name: "Cancha 2",
    court_surface: "dura",
    other_first_name: "Ana",
    other_last_name: "Lopez",
    i_am_owner: false,
  },
];

const RouteSpy = ({ label }: { label: string }) => {
  const loc = useLocation();
  return <div data-testid={`route-${label}`}>{loc.pathname}</div>;
};

const renderPage = async () => {
  const Page = (await import("@/pages/MisReservas")).default;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/mis-reservas"]}>
        <Routes>
          <Route path="/mis-reservas" element={<Page />} />
          <Route path="/reservar" element={<RouteSpy label="reservar" />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe("Página /mis-reservas", () => {
  beforeEach(() => {
    bookingsPayload = [];
    bookingsError = null;
    cancelShouldFail = false;
    downloadIcsSpy.mockClear();
    toastOkSpy.mockClear();
    toastErrSpy.mockClear();
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("loading: muestra skeletons", async () => {
    bookingsPayload = sampleBookings;
    const { container } = await renderPage();
    // Mientras la query está in-flight, ul[aria-label="Cargando reservas"] existe
    expect(container.querySelector('[aria-label="Cargando reservas"]')).toBeTruthy();
  });

  it("empty state: mensaje + CTA 'Buscar cancha' navega a /reservar", async () => {
    bookingsPayload = [];
    await renderPage();
    expect(await screen.findByText(/Sin reservas activas/i)).toBeInTheDocument();
    const cta = screen.getByRole("link", { name: /buscar cancha/i });
    expect(cta).toHaveAttribute("href", "/reservar");
  });

  it("renderiza N reservas con datos correctos (cancha, owner/invitado)", async () => {
    bookingsPayload = sampleBookings;
    await renderPage();
    expect(await screen.findByText("Cancha 1")).toBeInTheDocument();
    expect(screen.getByText("Cancha 2")).toBeInTheDocument();
    expect(screen.getByText(/Confirmada/i)).toBeInTheDocument();
    expect(screen.getByText(/Te invitaron/i)).toBeInTheDocument();
    // Partner
    expect(screen.getByText(/Con Juan P\./)).toBeInTheDocument();
    expect(screen.getByText(/Te invita Ana L\./)).toBeInTheDocument();
  });

  it("click 'Calendario' invoca downloadIcs con los datos correctos", async () => {
    bookingsPayload = [sampleBookings[0]];
    await renderPage();
    await screen.findByText("Cancha 1");
    const btns = screen.getAllByRole("button", { name: /^Calendario$/i });
    fireEvent.click(btns[0]);
    expect(downloadIcsSpy).toHaveBeenCalledTimes(1);
    const [payload, filename] = downloadIcsSpy.mock.calls[0];
    expect((payload as { title: string }).title).toMatch(/Cancha 1/);
    expect(filename).toMatch(/reserva-b-1\.ics/);
  });

  it("'Ver agenda' navega a /reservar", async () => {
    bookingsPayload = [sampleBookings[0]];
    await renderPage();
    await screen.findByText("Cancha 1");
    const link = screen.getByRole("link", { name: /ver agenda de canchas/i });
    expect(link).toHaveAttribute("href", "/reservar");
  });

  it("owner puede cancelar: éxito muestra toast.success", async () => {
    bookingsPayload = [sampleBookings[0]];
    await renderPage();
    await screen.findByText("Cancha 1");
    const cancelBtn = screen.getByRole("button", { name: /cancelar reserva/i });
    fireEvent.click(cancelBtn);
    await waitFor(() => {
      expect(toastOkSpy).toHaveBeenCalled();
    });
  });

  it("invitado: NO muestra botón cancelar", async () => {
    bookingsPayload = [sampleBookings[1]];
    await renderPage();
    await screen.findByText("Cancha 2");
    expect(screen.queryByRole("button", { name: /cancelar reserva/i })).not.toBeInTheDocument();
  });

  it("error: muestra alerta y botón Reintentar", async () => {
    bookingsError = { message: "fail" };
    await renderPage();
    expect(await screen.findByText(/No pudimos cargar tus reservas/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reintentar/i })).toBeInTheDocument();
  });

  it("header 'Buscar' navega a /reservar", async () => {
    bookingsPayload = sampleBookings;
    await renderPage();
    await screen.findByText("Cancha 1");
    const buscar = screen.getByRole("link", { name: /buscar nueva cancha/i });
    expect(buscar).toHaveAttribute("href", "/reservar");
  });
});
