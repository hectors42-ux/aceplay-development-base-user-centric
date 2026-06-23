import { Home, Compass, Swords, LayoutGrid, User } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useTournamentNotifications } from "@/hooks/useTournamentNotifications";
import { useLadderNotifications } from "@/hooks/useLadderNotifications";
import { useMatchInvitations } from "@/hooks/useMatchInvitations";
import { useMyOperatorTournaments } from "@/hooks/useMyOperatorTournaments";

// Navegación unificada (Épica F): 5 destinos con un FAB central "Desafío".
//  Inicio · Descubrir · (FAB Desafío → Competir) · Espacios · Perfil.
//  La Tienda NO es un tab: se entra desde la moneda de Fichas del HUD y Perfil.
//  "Desafío" lleva a la Zona de Juego (/ranking); "Espacios" al hub de torneos/
//  escalerilla. Todas las rutas previas siguen alcanzables.

const Badge = ({ label, syncing }: { label: string; syncing: boolean }) => (
  <span className="pointer-events-none absolute -right-1 -top-1">
    {syncing && <span aria-hidden className="absolute inset-0 rounded-full bg-destructive/60 animate-badge-ping-soft" />}
    <span aria-label={`${label} acciones pendientes`} aria-live="polite"
      className="relative flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold leading-none text-destructive-foreground ring-2 ring-background animate-badge-bump">
      {label}
    </span>
  </span>
);

export const BottomNav = () => {
  const location = useLocation();
  const { counts, loading: tournamentLoading } = useTournamentNotifications();
  const { counts: ladderCounts, loading: ladderLoading } = useLadderNotifications();
  const { received: partnerInvites, loading: partnerLoading } = useMatchInvitations();
  const { tournaments: operatorTournaments } = useMyOperatorTournaments();

  const partnerPendingCount = partnerInvites.filter(
    (i) => i.status === "pending" && new Date(i.expires_at) > new Date(),
  ).length;

  const items = [
    { id: "home", label: "Inicio", icon: Home, to: "/", fab: false, badge: 0, syncing: false, live: false },
    { id: "descubrir", label: "Descubrir", icon: Compass, to: "/descubrir", fab: false, badge: 0, syncing: false, live: false },
    { id: "desafio", label: "Desafío", icon: Swords, to: "/ranking", fab: true, badge: ladderCounts.total + partnerPendingCount, syncing: ladderLoading || partnerLoading, live: false },
    { id: "espacios", label: "Espacios", icon: LayoutGrid, to: "/espacios", fab: false, badge: counts.total, syncing: tournamentLoading, live: operatorTournaments.length > 0 },
    { id: "perfil", label: "Perfil", icon: User, to: "/perfil", fab: false, badge: 0, syncing: false, live: false },
  ];

  return (
    <nav aria-label="Navegación principal"
      style={{ bottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
      className="glass-nav-bar fixed left-3 right-3 z-40 rounded-[30px] md:hidden">
      <ul className="mx-auto flex max-w-md items-end justify-around px-3 py-2">
        {items.map((item) => {
          const Icon = item.icon;
          const active = item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to);
          const showBadge = item.badge > 0;
          const badgeLabel = item.badge > 9 ? "9+" : String(item.badge);

          if (item.fab) {
            return (
              <li key={item.id} className="flex-1">
                <NavLink to={item.to} aria-current={active ? "page" : undefined}
                  aria-label="Desafío" className="flex flex-col items-center gap-1">
                  <span className={cn(
                    "relative -mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-clay text-primary-foreground shadow-clay ring-4 ring-background transition-transform",
                    active ? "scale-105" : "hover:scale-105",
                  )}>
                    <Icon className="h-6 w-6" strokeWidth={2.4} />
                    {showBadge && <Badge label={badgeLabel} syncing={item.syncing} />}
                  </span>
                  <span className={cn("text-[10px] font-semibold tracking-wide", active ? "text-primary" : "text-foreground")}>{item.label}</span>
                </NavLink>
              </li>
            );
          }

          return (
            <li key={item.id} className="flex-1">
              <NavLink to={item.to} aria-current={active ? "page" : undefined}
                className={cn("flex w-full flex-col items-center gap-1 rounded-lg px-2 py-2 transition-smooth",
                  active ? "text-skill" : "text-muted-foreground hover:text-foreground")}>
                <span className={cn("relative flex h-9 w-9 items-center justify-center rounded-lg transition-smooth", active && "bg-skill/5")}>
                  {active && <span aria-hidden className="absolute -top-2 left-1/2 h-0.5 w-6 -translate-x-1/2 bg-skill" />}
                  <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
                  {item.live && !showBadge && (
                    <span aria-label="Modo operador activo" className="pointer-events-none absolute -right-1 -top-1 flex h-2.5 w-2.5">
                      <span aria-hidden className="absolute inline-flex h-full w-full rounded-full bg-destructive opacity-70 motion-safe:animate-ping" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-destructive ring-2 ring-background" />
                    </span>
                  )}
                  {showBadge && <Badge label={badgeLabel} syncing={item.syncing} />}
                </span>
                <span className="text-[10px] font-medium tracking-wide">{item.label}</span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
