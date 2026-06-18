import { Link, NavLink, Outlet } from "react-router-dom";
import { Home, Compass, User } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/", label: "Compite", icon: Home, end: true },
  { to: "/descubrir", label: "Descubrir", icon: Compass },
  { to: "/perfil", label: "Perfil", icon: User },
];

export function AppShell() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
          <Link to="/" className="font-display text-xl tracking-tight">
            AcePlay
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 pb-24 pt-4">
        <Outlet />
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-background/95 backdrop-blur">
        <ul className="mx-auto flex max-w-2xl items-stretch justify-around">
          {items.map(({ to, label, icon: Icon, end }) => (
            <li key={to} className="flex-1">
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    "flex flex-col items-center gap-1 py-3 text-xs",
                    isActive ? "text-primary" : "text-muted-foreground",
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