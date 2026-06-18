import { Link, NavLink, Outlet } from "react-router-dom";
import { Home, Trophy, Compass, CalendarDays, User } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/", label: "Inicio", icon: Home, end: true },
  { to: "/compite", label: "Compite", icon: Trophy },
  { to: "/descubrir", label: "Descubrir", icon: Compass },
  { to: "/reserva", label: "Reserva", icon: CalendarDays },
  { to: "/perfil", label: "Perfil", icon: User },
];

function ArcMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path
        d="M3 19 C 7 6, 17 6, 21 19"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <circle cx="12" cy="19" r="1.6" fill="currentColor" />
    </svg>
  );
}

export function AppShell() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 shadow-[0_1px_0_0_hsl(var(--border)/0.6)] backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2 text-primary">
            <ArcMark className="h-6 w-6" />
            <span className="font-display text-2xl leading-none tracking-tight text-foreground">
              AcePlay
            </span>
          </Link>
          <span className="hidden font-mono text-[10px] uppercase tracking-[0.32em] text-muted-foreground sm:inline">
            Tennis, gamified
          </span>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl px-4 pb-28 pt-5">
        <Outlet />
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <ul className="mx-auto flex w-full max-w-3xl items-stretch justify-around px-1">
          {items.map(({ to, label, icon: Icon, end }) => (
            <li key={to} className="flex-1">
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    "mx-0.5 my-1.5 flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10px] font-medium uppercase tracking-wider transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground",
                  )
                }
              >
                <Icon className="h-5 w-5" />
                <span>{label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}