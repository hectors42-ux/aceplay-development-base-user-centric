import { Suspense } from "react";
import { lazyWithRetry as lazy } from "@/lib/lazy-with-retry";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { ClubBrandProvider } from "@/components/providers/ClubBrandProvider";
import { SportProvider } from "@/components/providers/SportProvider";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import ScrollToTop from "@/components/ScrollToTop";
import { CelebrateProvider } from "@/hooks/useCelebrate";
import { ModuleDormant } from "@/components/ModuleDormant";
import { isModuleEnabled } from "@/config/modules";

// Rutas críticas: cargar de inmediato (mejor TTI tras abrir el PWA)
import Index from "./pages/Index.tsx";
import Auth from "./pages/Auth.tsx";

// Resto: lazy para acelerar el primer render del PWA
const ResetPassword = lazy(() => import("./pages/ResetPassword.tsx"));
const AcceptInvitation = lazy(() => import("./pages/AcceptInvitation.tsx"));
const AdminMembers = lazy(() => import("./pages/AdminMembers.tsx"));
const AdminCourts = lazy(() => import("./pages/AdminCourts.tsx"));
const Reservar = lazy(() => import("./pages/Reservar.tsx"));
const MisReservas = lazy(() => import("./pages/MisReservas.tsx"));
const Torneos = lazy(() => import("./pages/Torneos.tsx"));
const TorneoDetalle = lazy(() => import("./pages/TorneoDetalle.tsx"));
const SharePage = lazy(() => import("./pages/SharePage.tsx"));
const AdminTorneos = lazy(() => import("./pages/AdminTorneos.tsx"));
const AdminTorneoDetalle = lazy(() => import("./pages/AdminTorneoDetalle.tsx"));
const MisTorneos = lazy(() => import("./pages/MisTorneos.tsx"));
const AdminCategoryDetail = lazy(() => import("./pages/AdminCategoryDetail.tsx"));
const AdminCategoryPairs = lazy(() => import("./pages/AdminCategoryPairs.tsx"));
const TournamentCategoryDetail = lazy(() => import("./pages/TournamentCategoryDetail.tsx"));
const OperatorLiveBoard = lazy(() => import("./pages/OperatorLiveBoard.tsx"));
const ResultadoPendiente = lazy(() => import("./pages/ResultadoPendiente.tsx"));
const Ranking = lazy(() => import("./pages/Ranking.tsx"));
const CargarResultado = lazy(() => import("./pages/CargarResultado.tsx"));
const Escalerilla = lazy(() => import("./pages/Escalerilla.tsx"));
const Descubrir = lazy(() => import("./pages/Descubrir.tsx"));
const Tienda = lazy(() => import("./pages/Tienda.tsx"));
const TiendaItem = lazy(() => import("./pages/TiendaItem.tsx"));
const MisCanjes = lazy(() => import("./pages/MisCanjes.tsx"));
const TorneoBracket = lazy(() => import("./pages/TorneoBracket.tsx"));
const AdminLadder = lazy(() => import("./pages/AdminLadder.tsx"));
const AdminLadderDetail = lazy(() => import("./pages/AdminLadderDetail.tsx"));
const Onboarding = lazy(() => import("./pages/Onboarding.tsx"));
const Perfil = lazy(() => import("./pages/Perfil.tsx"));
const AvatarPicker = lazy(() => import("./pages/AvatarPicker.tsx"));
const PartnerMatchDetail = lazy(() => import("./pages/PartnerMatchDetail.tsx"));
const AdminAnnouncements = lazy(() => import("./pages/AdminAnnouncements.tsx"));
const AdminLegalDocs = lazy(() => import("./pages/AdminLegalDocs.tsx"));
const Clases = lazy(() => import("./pages/Clases.tsx"));
const CoachPanel = lazy(() => import("./pages/CoachPanel.tsx"));
const AdminClases = lazy(() => import("./pages/AdminClases.tsx"));
const Install = lazy(() => import("./pages/Install.tsx"));
const LiveOverlay = lazy(() => import("./pages/LiveOverlay.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));
const DevPreview = lazy(() => import("./pages/DevPreview.tsx"));
const DevQA = lazy(() => import("./pages/DevQA.tsx"));
const AnalyticsOverview = lazy(() => import("./pages/admin/analytics/AnalyticsOverview.tsx"));
const AnalyticsOperation = lazy(() => import("./pages/admin/analytics/AnalyticsOperation.tsx"));
const AnalyticsFinance = lazy(() => import("./pages/admin/analytics/AnalyticsFinance.tsx"));
const AnalyticsMembers = lazy(() => import("./pages/admin/analytics/AnalyticsMembers.tsx"));
const AnalyticsCoaches = lazy(() => import("./pages/admin/analytics/AnalyticsCoaches.tsx"));
const AnalyticsCommunity = lazy(() => import("./pages/admin/analytics/AnalyticsCommunity.tsx"));
const AnalyticsAlerts = lazy(() => import("./pages/admin/analytics/AnalyticsAlerts.tsx"));
const AnalyticsDirectory = lazy(() => import("./pages/admin/analytics/AnalyticsDirectory.tsx"));
const AdminQACompetir = lazy(() => import("./pages/admin/AdminQACompetir.tsx"));
const AdminBrands = lazy(() => import("./pages/admin/AdminBrands.tsx"));
const AdminRewards = lazy(() => import("./pages/admin/AdminRewards.tsx"));
const AdminPlacements = lazy(() => import("./pages/admin/AdminPlacements.tsx"));
const AdminEconomy = lazy(() => import("./pages/admin/AdminEconomy.tsx"));
const OrganizerPanel = lazy(() => import("./pages/admin/OrganizerPanel.tsx"));
const AdminDemoProtocol = lazy(() => import("./pages/admin/AdminDemoProtocol.tsx"));
const AnalyticsLayout = lazy(() =>
  import("./components/analytics/AnalyticsLayout").then((m) => ({ default: m.AnalyticsLayout }))
);

// Defaults globales: cache compartido entre páginas para navegación instantánea.
// staleTime 60s: muestra datos cacheados mientras se hace refetch silencioso (estilo SWR).
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Fallback minimalista para no parpadear durante el carga de un chunk
const RouteFallback = () => (
  <div className="min-h-screen bg-background" aria-hidden />
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <ClubBrandProvider>
            <SportProvider>
            <TooltipProvider>
              <CelebrateProvider>
              <Toaster />
              <Sonner />
              <ScrollToTop />
              <Suspense fallback={<RouteFallback />}>
                <Routes>
                  <Route
                    path="/"
                    element={
                      <ProtectedRoute>
                        <Index />
                      </ProtectedRoute>
                    }
                  />

                  <Route path="/auth" element={<Auth />} />

                  <Route path="/auth" element={<Auth />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/accept-invitation" element={<AcceptInvitation />} />
                  <Route path="/install" element={<Install />} />
                  <Route path="/live/:slug" element={<LiveOverlay />} />

                  <Route path="/app" element={<Navigate to="/" replace />} />
                  <Route path="/inicio" element={<Navigate to="/" replace />} />

                  <Route
                    path="/onboarding/nivel"
                    element={
                      <ProtectedRoute requireRatingOnboarding={false} bareLayout>
                        <Onboarding />
                      </ProtectedRoute>
                    }
                  />

                  <Route
                    path="/reservar"
                    element={
                      <ProtectedRoute>
                        {isModuleEnabled("reservas") ? <Reservar /> : <ModuleDormant module="reservas" />}
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/mis-reservas"
                    element={
                      <ProtectedRoute>
                        {isModuleEnabled("reservas") ? <MisReservas /> : <ModuleDormant module="reservas" />}
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/torneos"
                    element={
                      <ProtectedRoute>
                        <Torneos />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/torneos/:slug"
                    element={
                      <ProtectedRoute>
                        <TorneoDetalle />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/torneos/:slug/cat/:catId"
                    element={
                      <ProtectedRoute>
                        <TournamentCategoryDetail />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/torneos/:slug/operador"
                    element={
                      <ProtectedRoute>
                        <OperatorLiveBoard />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/torneos/:slug/compartir"
                    element={
                      <ProtectedRoute>
                        <SharePage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/resultado-pendiente/:matchId"
                    element={
                      <ProtectedRoute>
                        <ResultadoPendiente />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/mis-torneos"
                    element={
                      <ProtectedRoute>
                        <MisTorneos />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/ranking"
                    element={
                      <ProtectedRoute>
                        <Ranking />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/ladder"
                    element={
                      <ProtectedRoute>
                        <Ranking />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/cargar"
                    element={
                      <ProtectedRoute>
                        <CargarResultado />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/escalerilla"
                    element={
                      <ProtectedRoute>
                        <Escalerilla />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/descubrir"
                    element={
                      <ProtectedRoute>
                        <Descubrir />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/tienda"
                    element={
                      <ProtectedRoute>
                        <Tienda />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/tienda/:id"
                    element={
                      <ProtectedRoute>
                        <TiendaItem />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/mis-canjes"
                    element={
                      <ProtectedRoute>
                        <MisCanjes />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/torneo"
                    element={
                      <ProtectedRoute>
                        <TorneoBracket />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/perfil"
                    element={
                      <ProtectedRoute>
                        <Perfil />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/perfil/avatar"
                    element={
                      <ProtectedRoute>
                        <AvatarPicker />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/partner/match/:id"
                    element={
                      <ProtectedRoute>
                        <PartnerMatchDetail />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/clases"
                    element={
                      <ProtectedRoute>
                        {isModuleEnabled("clases") ? <Clases /> : <ModuleDormant module="clases" />}
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/coach"
                    element={
                      <ProtectedRoute>
                        {isModuleEnabled("clases") ? <CoachPanel /> : <ModuleDormant module="clases" />}
                      </ProtectedRoute>
                    }
                  />

                  <Route
                    path="/admin/socios"
                    element={
                      <ProtectedRoute requiredRole={["club_admin", "super_admin"]}>
                        <AdminMembers />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/brands"
                    element={
                      <ProtectedRoute requiredRole={["club_admin", "super_admin"]}>
                        <AdminBrands />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/rewards"
                    element={
                      <ProtectedRoute requiredRole={["club_admin", "super_admin"]}>
                        <AdminRewards />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/placements"
                    element={
                      <ProtectedRoute requiredRole={["club_admin", "super_admin"]}>
                        <AdminPlacements />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/economy"
                    element={
                      <ProtectedRoute requiredRole={["club_admin", "super_admin"]}>
                        <AdminEconomy />
                      </ProtectedRoute>
                    }
                  />
                  {/* Panel del organizador: accesible a admin u organizador (el RPC acota los datos). */}
                  <Route
                    path="/admin/organizer"
                    element={
                      <ProtectedRoute>
                        <OrganizerPanel />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/canchas"
                    element={
                      <ProtectedRoute requiredRole={["club_admin", "super_admin"]}>
                        {isModuleEnabled("reservas") ? <AdminCourts /> : <ModuleDormant module="reservas" />}
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/torneos"
                    element={
                      <ProtectedRoute requiredRole={["club_admin", "super_admin"]}>
                        <AdminTorneos />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/torneos/:id"
                    element={
                      <ProtectedRoute requiredRole={["club_admin", "super_admin"]}>
                        <AdminTorneoDetalle />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/torneos/:id/cat/:catId"
                    element={
                      <ProtectedRoute requiredRole={["club_admin", "super_admin"]}>
                        <AdminCategoryDetail />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/torneos/:id/cat/:catId/parejas"
                    element={
                      <ProtectedRoute requiredRole={["club_admin", "super_admin"]}>
                        <AdminCategoryPairs />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/ladder"
                    element={
                      <ProtectedRoute requiredRole={["club_admin", "super_admin"]}>
                        <AdminLadder />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/ladder/:id"
                    element={
                      <ProtectedRoute requiredRole={["club_admin", "super_admin"]}>
                        <AdminLadderDetail />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/comunicaciones"
                    element={
                      <ProtectedRoute requiredRole={["club_admin", "super_admin"]}>
                        <AdminAnnouncements />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/documentos"
                    element={
                      <ProtectedRoute requiredRole={["club_admin", "super_admin"]}>
                        <AdminLegalDocs />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/clases"
                    element={
                      <ProtectedRoute requiredRole={["club_admin", "super_admin"]}>
                        {isModuleEnabled("clases") ? <AdminClases /> : <ModuleDormant module="clases" />}
                      </ProtectedRoute>
                    }
                  />

                  <Route
                    element={
                      <ProtectedRoute requiredRole={["club_admin", "super_admin"]}>
                        <AnalyticsLayout />
                      </ProtectedRoute>
                    }
                  >
                    <Route path="/admin/analytics" element={<AnalyticsOverview />} />
                    <Route path="/admin/analytics/operacion" element={<AnalyticsOperation />} />
                    <Route path="/admin/analytics/finanzas" element={<AnalyticsFinance />} />
                    <Route path="/admin/analytics/socios" element={<AnalyticsMembers />} />
                    <Route path="/admin/analytics/coaches" element={<AnalyticsCoaches />} />
                    <Route path="/admin/analytics/comunidad" element={<AnalyticsCommunity />} />
                    <Route path="/admin/analytics/alertas" element={<AnalyticsAlerts />} />
                  </Route>
                  <Route
                    path="/admin/analytics/directorio"
                    element={
                      <ProtectedRoute requiredRole={["super_admin"]}>
                        <AnalyticsLayout />
                      </ProtectedRoute>
                    }
                  >
                    <Route index element={<AnalyticsDirectory />} />
                  </Route>

                  <Route
                    path="/admin/qa/competir"
                    element={
                      <ProtectedRoute requiredRole={["club_admin", "super_admin"]}>
                        <AdminQACompetir />
                      </ProtectedRoute>
                    }
                  />

                  <Route
                    path="/admin/qa/protocolo"
                    element={
                      <ProtectedRoute requiredRole={["club_admin", "super_admin"]}>
                        <AdminDemoProtocol />
                      </ProtectedRoute>
                    }
                  />

                  <Route path="/dev/preview" element={<DevPreview />} />
                  {import.meta.env.DEV && (
                    <Route path="/dev/qa" element={<DevQA />} />
                  )}

                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
              </CelebrateProvider>
            </TooltipProvider>
            </SportProvider>
          </ClubBrandProvider>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
