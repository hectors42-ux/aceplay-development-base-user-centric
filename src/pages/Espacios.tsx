import { Link } from "react-router-dom";
import { Trophy, ListOrdered, ClipboardCheck, ChevronRight, LayoutGrid, Compass } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { useAuth } from "@/components/providers/AuthProvider";

// Hub "Espacios": punto de entrada a las superficies competitivas del jugador
// (torneos, escalerilla, cargar resultado). Conserva el acceso a rutas que ya
// no tienen tab propio en la nav unificada. Estructura mínima (sin reskin fino).
const ENTRIES = [
  { to: "/torneos", icon: Trophy, title: "Torneos", desc: "Cuadros y categorías de tu club" },
  { to: "/escalerilla", icon: ListOrdered, title: "Escalerilla", desc: "Reta y sube posiciones" },
  { to: "/cargar", icon: ClipboardCheck, title: "Cargar resultado", desc: "Registra y confirma partidos" },
  { to: "/descubrir", icon: Compass, title: "Descubrir", desc: "Eventos abiertos de la red" },
];

const Espacios = () => {
  const { profile, loading } = useAuth();
  const memberName = loading && !profile ? "" : profile ? `${profile.first_name} ${profile.last_name}`.trim() : "Socio";

  return (
    <div className="min-h-screen bg-background pb-28">
      <AppHeader memberName={memberName} greeting="Tus espacios" interactive={false} />
      <main className="mx-auto max-w-md px-5 py-4 md:max-w-2xl">
        <h1 className="mb-1 flex items-center gap-2 font-display text-xl font-semibold">
          <LayoutGrid className="h-5 w-5 text-primary" /> Espacios
        </h1>
        <p className="mb-4 text-xs text-muted-foreground">Donde compites: torneos, escalerilla y resultados.</p>

        <div className="space-y-2">
          {ENTRIES.map((e) => {
            const Icon = e.icon;
            return (
              <Link key={e.to} to={e.to}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-card transition-smooth hover:border-primary/40 hover:bg-muted/40">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" strokeWidth={2.2} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-sm font-semibold">{e.title}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{e.desc}</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            );
          })}
        </div>
      </main>
      <BottomNav />
    </div>
  );
};

export default Espacios;
