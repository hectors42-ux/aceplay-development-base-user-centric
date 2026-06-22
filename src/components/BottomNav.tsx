import { Home, Trophy, Swords, User } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useTournamentNotifications } from "@/hooks/useTournamentNotifications";
import { useLadderNotifications } from "@/hooks/useLadderNotifications";
import { useMatchInvitations } from "@/hooks/useMatchInvitations";
import { useMyOperatorTournaments } from "@/hooks/useMyOperatorTournaments";

// "Reservar" se quitó de la navegación: es un módulo dormido (ver
// src/config/modules.ts). Al activar reservas, volver a añadir el item aquí.
const baseItems = [
  { id: "home", label: "Inicio", icon: Home, to: "/" },
  { id: "competir", label: "Competir", icon: Swords, to: "/ranking" },
  { id: "torneos", label: "Torneos", icon: Trophy, to: "/torneos" },
  { id: "perfil", label: "Perfil", icon: User, to: "/perfil" },
];

export const BottomNav = () => {
  const location = useLocation();
  const { counts, loading: tournamentLoading } = useTournamentNotifications();
  const { counts: ladderCounts, loading: ladderLoading } = useLadderNotifications();
  const { received: partnerInvites, loading: partnerLoading } = useMatchInvitations();
  const { tournaments: operatorTournaments } = useMyOperatorTournaments();
  // Invitaciones de "Buscar partner" pendientes de respuesta (no expiradas).
  const partnerPendingCount = partnerInvites.filter(
    (i) => i.status === "pending" && new Date(i.expires_at) > new Date(),
  ).length;
  const items = baseItems.map((it) => ({ ...it, external: false as const }));
  return (
    <nav
      aria-label="Navegación principal"
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/80 backdrop-blur-xl safe-bottom md:hidden"
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-around px-2 pt-2">
        {items.map((item) => {
          const Icon = item.icon;
          const active = item.to
            ? item.to === "/"
              ? location.pathname === "/"
              : location.pathname.startsWith(item.to)
            : false;
          const isTournament = item.id === "torneos";
          const isLadder = item.id === "competir";
          const showLiveDot = isTournament && operatorTournaments.length > 0;
          const badgeCount = isTournament
            ? counts.total
            : isLadder
              ? ladderCounts.total + partnerPendingCount
              : 0;
          // `loading` aquí indica que estamos consultando el RPC tras un
          // evento Realtime (o al montar). Solo lo mostramos en los items
          // con notificaciones para no contaminar el resto.
          const isSyncing =
            (isTournament && tournamentLoading) ||
            (isLadder && (ladderLoading || partnerLoading));
          const showBadge = badgeCount > 0;
          const badgeLabel = badgeCount > 9 ? "9+" : String(badgeCount);
          const inner = (
            <>
              <span
                className={cn(
                  "relative flex h-9 w-9 items-center justify-center rounded-lg transition-smooth",
                  active && "bg-primary/5",
                )}
              >
                {active && (
                  <span
                    aria-hidden
                    className="absolute -top-2 left-1/2 h-0.5 w-6 -translate-x-1/2 bg-primary"
                  />
                )}
                <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
                {showLiveDot && !showBadge && (
                  <span
                    aria-label="Modo operador activo"
                    className="pointer-events-none absolute -right-1 -top-1 flex h-2.5 w-2.5"
                  >
                    <span
                      aria-hidden
                      className="absolute inline-flex h-full w-full rounded-full bg-destructive opacity-70 motion-safe:animate-ping"
                    />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-destructive ring-2 ring-background" />
                  </span>
                )}
                {showBadge && (
                  <span className="pointer-events-none absolute -right-1 -top-1">
                    {/* Halo pulsante mientras sincronizamos en background */}
                    {isSyncing && (
                      <span
                        aria-hidden
                        className="absolute inset-0 rounded-full bg-destructive/60 animate-badge-ping-soft"
                      />
                    )}
                    <span
                      key={badgeCount}
                      aria-label={`${badgeCount} acciones pendientes${isSyncing ? " (sincronizando)" : ""}`}
                      aria-live="polite"
                      className={cn(
                        "relative flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold leading-none text-destructive-foreground ring-2 ring-background animate-badge-bump",
                      )}
                    >
                      {badgeLabel}
                    </span>
                  </span>
                )}
                {/* Nota: anteriormente se mostraba un punto de "sincronizando"
                    cuando no había badge, pero generaba un flash visual al
                    navegar entre páginas (los hooks re-ejecutan su refresh
                    inicial). Lo retiramos: el badge pulsante sigue indicando
                    refresco cuando hay acciones pendientes. */}
              </span>
              <span className="text-[10px] font-medium tracking-wide">{item.label}</span>
            </>
          );
          const className = cn(
            "flex w-full flex-col items-center gap-1 rounded-lg px-2 py-2 transition-smooth",
            active
              ? "text-primary"
              : item.to
                ? "text-muted-foreground hover:text-foreground"
                : "text-muted-foreground/40 cursor-not-allowed",
          );
          return (
            <li key={item.id} className="flex-1">
              {item.to ? (
                <NavLink to={item.to} className={className} aria-current={active ? "page" : undefined}>
                  {inner}
                </NavLink>
              ) : (
                <div className={className} aria-disabled>
                  {inner}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
