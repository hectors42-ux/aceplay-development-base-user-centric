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
import { CoinHud } from "@/components/home/CoinHud";
import { UserAvatar } from "@/components/avatar/UserAvatar";
import { getLevelBand } from "@/lib/rating-utils";
import { BadgesGrid } from "@/components/profile/BadgesGrid";
import { ProfileEditDialog } from "@/components/profile/ProfileEditDialog";

import { LegalLinksList } from "@/components/legal/LegalLinksList";
import { WelcomeTour, resetWelcomeTour } from "@/components/onboarding/WelcomeTour";
import { NotificationPreferencesCard } from "@/components/profile/NotificationPreferencesCard";
import { Button } from "@/components/ui/button";
import { useClubBrand } from "@/components/providers/ClubBrandProvider";
import { useCanCreate } from "@/hooks/useCanCreate";
import { Zap, Coins, Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import { TierGem, type Tier } from "@/components/arena";
import { useActiveSport } from "@/components/providers/SportProvider";
import { useUserProfileSummary } from "@/hooks/useUserProfileSummary";
import { useLeague, tierName } from "@/hooks/useEconomy";
import { useFichas } from "@/hooks/useFichas";

// Tier de liga (número) → gema TierGem (Madera→Platino).
const PERFIL_TIER_GEM: Tier[] = ["madera", "bronce", "plata", "oro", "platino", "platino"];
const gemForTier = (t?: number | null): Tier => PERFIL_TIER_GEM[Math.min(Math.max(t ?? 0, 0), 5)];

const Perfil = () => {
  const { profile, user, isAdmin, signOut } = useAuth();
  const { ratingSport } = useActiveSport();
  const { data: summary } = useUserProfileSummary(user?.id ?? null, ratingSport);
  const { data: league = [] } = useLeague();
  const { data: fichas } = useFichas();
  const myTier = league.find((m) => m.is_me)?.tier ?? null;
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
      {/* HUD doble moneda (liquid glass) */}
      <div className="safe-top sticky top-0 z-30 px-3 pt-2">
        <CoinHud
          className="mx-auto max-w-md"
          rating={summary?.rating?.level != null ? Number(summary.rating.level).toFixed(1) : undefined}
        />
      </div>
      <header className="z-10">
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
        {/* Cabecera de identidad (diseño perfil.png): avatar con anillo volt +
            insignia de categoría + nombre grande + handle/antigüedad. */}
        {user && (
          <section className="px-5 pt-1 text-center">
            <span className="mx-auto block w-fit rounded-full" style={{ boxShadow: "0 0 0 2.5px hsl(var(--skill))" }}>
              <UserAvatar
                kind={profile?.avatar_kind}
                look={profile?.avatar_look}
                url={profile?.avatar_url}
                name={memberName}
                className="h-24 w-24"
              />
            </span>
            {summary?.rating?.level != null && (
              <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.1em] text-foreground">
                <span aria-hidden className="h-2.5 w-2.5 rotate-45 rounded-[2px] bg-skill" />
                {getLevelBand(summary.rating.level).label}
              </span>
            )}
            <h1 className="mt-2 font-display text-3xl font-black uppercase tracking-tight text-foreground">{memberName}</h1>
            {(ext.handle || summary?.profile?.member_since) && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {ext.handle ? `@${ext.handle}` : ""}
                {ext.handle && summary?.profile?.member_since ? " · " : ""}
                {summary?.profile?.member_since ? `miembro desde ${summary.profile.member_since}` : ""}
              </p>
            )}
          </section>
        )}

        {/* Dos CAPAS separadas y explícitas: habilidad (Rating·Skill) ≠ premio (Fichas). */}
        {user && (
          <section className="px-5" aria-label="Tus capas">
            <div className="grid grid-cols-2 gap-3">
              {/* HABILIDAD — Rating / Skill (volt) */}
              <div className="rounded-2xl border border-skill/30 bg-skill/5 p-3">
                <div className="flex items-center gap-1.5 text-skill">
                  <Zap className="h-4 w-4" />
                  <span className="text-[10px] font-bold uppercase tracking-wide">Rating · Skill</span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <p className="font-display text-2xl font-bold leading-none tabular-nums text-foreground">
                    {summary?.rating?.level != null ? Number(summary.rating.level).toFixed(1) : "—"}
                  </p>
                  {myTier != null && <TierGem tier={gemForTier(myTier)} size="sm" title={`Liga ${tierName(myTier)}`} />}
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground">Se gana jugando · no se canjea</p>
              </div>
              {/* PREMIO — Fichas (oro) */}
              <Link to="/tienda" className="block rounded-2xl border border-fichas/30 bg-fichas/5 p-3 transition-smooth hover:bg-fichas/10">
                <div className="flex items-center gap-1.5 text-fichas">
                  <Coins className="h-4 w-4" />
                  <span className="text-[10px] font-bold uppercase tracking-wide">Puntos · Fichas</span>
                </div>
                <p className="mt-1 font-display text-2xl font-bold leading-none tabular-nums text-foreground">
                  {fichas?.balance ?? 0}
                </p>
                <p className="mt-1 text-[10px] text-muted-foreground">Toca para canjear</p>
              </Link>
            </div>
          </section>
        )}

        {/* Rejilla de stats (diseño perfil.png): Ranking · Récord · Racha · Jugados. */}
        {user && summary && (
          <section className="px-5" aria-label="Estadísticas">
            <div className="grid grid-cols-2 gap-3">
              {[
                { k: "Ranking", v: summary.positions.ranking != null ? `#${summary.positions.ranking}` : "—", cls: "text-action" },
                { k: "Récord", v: `${summary.stats.wins}–${summary.stats.losses}`, cls: "text-foreground" },
                {
                  k: "Racha",
                  v: (
                    <span className="inline-flex items-center gap-1.5">
                      {summary.stats.streak > 0 && <Flame className="h-5 w-5 text-action" />}
                      <span className="tabular-nums">{Math.abs(summary.stats.streak)}</span>
                    </span>
                  ),
                  cls: "text-foreground",
                },
                { k: "Jugados", v: summary.rating?.matches_played ?? 0, cls: "text-foreground" },
              ].map((s) => (
                <div key={s.k} className="rounded-2xl border border-border bg-card p-4 text-center shadow-card">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{s.k}</p>
                  <p className={cn("mt-1 font-display text-2xl font-bold leading-none", s.cls)}>{s.v}</p>
                </div>
              ))}
            </div>
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
            <Gift className="h-4 w-4 text-fichas" /> Premios
          </h2>
          <div className="space-y-2">
            <Link to="/tienda" className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 text-sm font-medium text-foreground shadow-card transition-smooth hover:bg-muted">
              <span className="flex items-center gap-2"><Gift className="h-4 w-4 text-fichas" /> Tienda de premios</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
            <Link to="/mis-canjes" className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 text-sm font-medium text-foreground shadow-card transition-smooth hover:bg-muted">
              <span className="flex items-center gap-2"><Ticket className="h-4 w-4 text-fichas" /> Mis canjes</span>
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
