import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { RequireAuth, RequireOnboarded } from "@/components/Guards";
import Login from "@/pages/Login";
import Onboarding from "@/pages/Onboarding";
import Inicio from "@/pages/Inicio";
import Compite from "@/pages/Compite";
import Descubrir from "@/pages/Descubrir";
import SpacePage from "@/pages/Space";
import Perfil from "@/pages/Perfil";
import ComingSoon from "@/pages/ComingSoon";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/onboarding"
              element={
                <RequireAuth>
                  <Onboarding />
                </RequireAuth>
              }
            />
            <Route
              element={
                <RequireAuth>
                  <RequireOnboarded>
                    <AppShell />
                  </RequireOnboarded>
                </RequireAuth>
              }
            >
              <Route path="/" element={<Inicio />} />
              <Route path="/compite" element={<Compite />} />
              <Route path="/descubrir" element={<Descubrir />} />
              <Route path="/space/:id" element={<SpacePage />} />
              <Route path="/reserva" element={<ComingSoon title="Reserva" copy="Pronto podrás reservar cancha desde aquí." />} />
              <Route path="/torneos" element={<ComingSoon title="Torneos" copy="La vitrina de torneos llega muy pronto." />} />
              <Route path="/perfil" element={<Perfil />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
          <Toaster />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}