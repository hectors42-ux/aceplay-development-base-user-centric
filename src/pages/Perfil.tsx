import { useState } from "react";
import { SportBadge } from "@/components/SportBadge";
import {
  ArrowLeft,
  Pencil,
  FileText,
  LogOut,
  Settings,
  Megaphone,
  Users,
  Trophy,
  ListOrdered,
  ChevronRight,
  Gift,
  Ticket,
  Download,
  Sparkles,
  BarChart3,
  Building2,
  SlidersHorizontal,
} from "lucide-react";
import { AnalyticsManualDialog } from "@/components/analytics/AnalyticsManualDialog";
import { Link } from "react-router-dom";
import { useAuth } from "@/components/providers/AuthProvider";
import { BottomNav } from "@/components/BottomNav";
import { ThemePicker } from "@/components/ThemePicker";
import { PlayerProfileCard } from "@/components/profile/PlayerProfileCard";
import { BadgesGrid } from "@/components/profile/BadgesGrid";
import { ProfileEditDialog } from "@/components/profile/ProfileEditDialog";

import { LegalLinksList } from "@/components/legal/LegalLinksList";
import { WelcomeTour, resetWelcomeTour } from "@/components/onboarding/WelcomeTour";
import { NotificationPreferencesCard } from "@/components/profile/NotificationPreferencesCard";
import { Button } from "@/components/ui/button";
import { useClubBrand } from "@/components/providers/ClubBrandProvider";
import { useCanCreate } from "@/hooks/useCanCreate";

const Perfil = () => {
  const { profile, user, isAdmin, signOut } = useAuth();
  const { canCreate } = useCanCreate();
  const { brand } = useClubBrand();
  const [editing, setEditing] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);

  const openTour = () => {
    resetWelcomeTour();
    setTourOpen(true);
  };

  const memberName = profile
    ? `${profile.first_name} ${profile.last_name}`.trim()
    : "Mi perfil";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ext = (profile ?? {}) as any;

  return (
    <div className="min-h-screen bg-gradient-warm">
      <header className="safe-top sticky top-0 z-10 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-md items-center gap-3 px-5 pb-3 pt-3">
          <Link
            to="/"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-foreground transition-smooth hover:bg-muted/70"
            aria-label="Volver al inicio"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={2.5} />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Perfil
            </p>
            <h1 className="truncate font-display text-lg font-semibold text-foreground">
              {memberName}
            </h1>
          </div>
          <SportBadge />
          {profile && (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              <Pencil className="mr-1 h-3 w-3" /> Editar
            </Button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-md space-y-4 pb-24 pt-3">
        {user && (
          <section className="px-5">
            <PlayerProfileCard userId={user.id} mode="own" />
          </section>
        )}

        {user && (
          <section className="space-y-2 px-5">
            <h2 className="font-display text-base font-semibold">Logros</h2>
            <BadgesGrid userId={user.id} />
          </section>
        )}

        <section className="space-y-2 px-5">
          <h2 className="flex items-center gap-2 font-display text-base font-semibold">
            <Gift className="h-4 w-4" /> Premios
          </h2>
          <div className="space-y-2">
            <Link to="/tienda" className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 text-sm font-medium text-foreground shadow-card transition-smooth hover:bg-muted">
              <span className="flex items-center gap-2"><Gift className="h-4 w-4 text-primary" /> Tienda de premios</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
            <Link to="/mis-canjes" className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 text-sm font-medium text-foreground shadow-card transition-smooth hover:bg-muted">
              <span className="flex items-center gap-2"><Ticket className="h-4 w-4 text-primary" /> Mis canjes</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          </div>
        </section>

        {canCreate && !isAdmin && (
          <section className="space-y-2 px-5">
            <h2 className="flex items-center gap-2 font-display text-base font-semibold">
              <BarChart3 className="h-4 w-4" /> Organizador
            </h2>
            <Link to="/admin/organizer" className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 text-sm font-medium text-foreground shadow-card transition-smooth hover:bg-muted">
              <span className="flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" /> Métricas de mis torneos</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          </section>
        )}

        <section className="space-y-2 px-5">
          <h2 className="flex items-center gap-2 font-display text-base font-semibold">
            <Settings className="h-4 w-4" /> Preferencias
          </h2>
          <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
            <ThemePicker />
          </div>
        </section>

        {isAdmin && (
          <section className="space-y-2 px-5">
            <h2 className="flex items-center gap-2 font-display text-base font-semibold">
              <Settings className="h-4 w-4" /> Administración del club
            </h2>
            <div className="space-y-2">
              {/* "Canchas y reglas" y "Clases & coaches" se quitan: módulos dormidos. */}
              {[
                { to: "/admin/socios", icon: Users, label: "Administrar socios" },
                { to: "/admin/torneos", icon: Trophy, label: "Administrar torneos" },
                { to: "/admin/ladder", icon: ListOrdered, label: "Administrar Escalerilla" },
                { to: "/admin/brands", icon: Building2, label: "Marcas" },
                { to: "/admin/rewards", icon: Gift, label: "Catálogo de Fichas" },
                { to: "/admin/placements", icon: Megaphone, label: "Placements de marca" },
                { to: "/admin/organizer", icon: BarChart3, label: "Métricas de organizador" },
                { to: "/admin/economy", icon: SlidersHorizontal, label: "Economía (config)" },
                { to: "/admin/comunicaciones", icon: Megaphone, label: "Anuncios del club" },
                { to: "/admin/documentos", icon: FileText, label: "Reglamentos y documentos" },
              ].map(({ to, icon: Icon, label }) => (
                <Link
                  key={to}
                  to={to}
                  className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 text-sm font-medium text-foreground shadow-card transition-smooth hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-primary" />
                    {label}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              ))}
            </div>

            <div className="space-y-2 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card p-3 shadow-card">
              <Link
                to="/admin/analytics"
                className="flex items-center justify-between rounded-xl bg-primary/10 px-3 py-2 text-sm font-semibold text-foreground transition-smooth hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  Analítica del club
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
              <AnalyticsManualDialog />
            </div>
          </section>
        )}

        <NotificationPreferencesCard />

        <section className="space-y-2 px-5">
          <h2 className="flex items-center gap-2 font-display text-base font-semibold">
            <FileText className="h-4 w-4" /> Documentos y ayuda
          </h2>
          <LegalLinksList />
          <button
            type="button"
            onClick={openTour}
            className="flex w-full items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 text-sm font-medium text-foreground shadow-card transition-smooth hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Ver tour de bienvenida
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
          <Link
            to="/install"
            className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 text-sm font-medium text-foreground shadow-card transition-smooth hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex items-center gap-2">
              <Download className="h-4 w-4 text-primary" />
              Instalar app en tu teléfono
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        </section>


        <section className="px-5">
          <Button
            variant="outline"
            className="w-full justify-center gap-2"
            onClick={() => signOut()}
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </Button>
        </section>

        <footer className="space-y-1 px-5 pt-2 text-center">
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            {brand.name} · {new Date().getFullYear()}
          </p>
          <p className="text-[10px] text-muted-foreground/80">
            Todos los derechos reservados.
          </p>
        </footer>
      </main>

      {profile && (
        <ProfileEditDialog
          open={editing}
          onOpenChange={setEditing}
          profile={profile as never}
          onSaved={() => undefined}
        />
      )}

      <WelcomeTour open={tourOpen} onOpenChange={setTourOpen} />

      <BottomNav />
    </div>
  );
};

export default Perfil;
