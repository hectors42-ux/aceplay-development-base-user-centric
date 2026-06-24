import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronLeft, Zap, MapPin, Swords, User as UserIcon } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/avatar/UserAvatar";
import { useSuggestedPartners } from "@/hooks/useCancha";
import { partnerReason } from "@/lib/cancha-utils";
import { cn } from "@/lib/utils";

const FILTERS = [
  { id: "zona", label: "Tu Zona" },
  { id: "club", label: "Mi club" },
] as const;

const BuscarPartner = () => {
  const navigate = useNavigate();
  const { data: all = [], isLoading } = useSuggestedPartners(20);
  const [filter, setFilter] = useState<"zona" | "club">("zona");

  // "Mi club" = solo quienes comparten un espacio conmigo (proximidad real disponible).
  const partners = filter === "club" ? all.filter((p) => p.shared_space_id) : all;

  return (
    <div className="min-h-screen bg-background">
      <header className="safe-top sticky top-0 z-30 bg-background/80 px-5 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center gap-2">
          <Link to="/cancha" aria-label="Volver" className="grid h-9 w-9 place-items-center rounded-full hover:bg-muted">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h1 className="font-display text-lg font-bold tracking-tight text-foreground">Buscar partner</h1>
        </div>
      </header>

      <main className="mx-auto max-w-md space-y-3 px-5 pb-28 pt-2">
        {/* Filtros */}
        <div className="flex gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                "rounded-full border px-4 py-1.5 text-xs font-semibold transition-smooth",
                filter === f.id
                  ? "border-action bg-action text-action-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Regla de orden visible */}
        <div className="flex items-start gap-2 rounded-2xl border border-skill/25 bg-skill/[0.05] px-4 py-3">
          <Zap className="mt-0.5 h-4 w-4 shrink-0 text-skill" />
          <p className="text-xs leading-relaxed text-muted-foreground">
            Ordenados por <span className="font-semibold text-skill">nivel parejo</span> +{" "}
            <span className="font-semibold text-foreground">facilidad de concretar</span>. Empate → más cercano.
          </p>
        </div>

        {isLoading && <div className="h-28 animate-pulse rounded-2xl border border-border bg-card/60" aria-hidden />}
        {!isLoading && partners.length === 0 && (
          <p className="rounded-2xl border border-border bg-card/60 px-4 py-6 text-center text-sm text-muted-foreground">
            No hay rivales sugeridos en tu Zona por ahora.
          </p>
        )}

        {partners.map((p, i) => (
          <article key={p.user_id} className="rounded-2xl border border-border bg-card p-4 shadow-card">
            <div className="flex items-start gap-3">
              <span className="block shrink-0 rounded-full ring-2 ring-skill/50">
                <UserAvatar kind={p.avatar_kind} look={p.avatar_look} url={p.avatar_url} name={p.name ?? "Rival"} className="h-12 w-12" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-display text-base font-bold text-foreground">{p.name ?? "Rival"}</p>
                  {i === 0 && filter === "zona" && (
                    <span className="shrink-0 rounded-full bg-skill/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-skill">
                      Top match
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Niv {p.nivel != null ? Number(p.nivel).toFixed(0) : "—"}
                  {p.category ? ` · ${p.category}` : ""}
                </p>
                <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                  <MapPin className="h-3 w-3" /> {partnerReason(p.shared_space_name)}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-display text-2xl font-black leading-none text-skill tabular-nums">{p.match_pct}%</p>
                <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">match</p>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <Button asChild variant="outline" size="sm" className="flex-1 gap-1">
                <Link to={`/jugador/${p.user_id}`}>
                  <UserIcon className="h-4 w-4" /> Ver perfil
                </Link>
              </Button>
              <Button variant="clay" size="sm" className="flex-1 gap-1" onClick={() => navigate(`/cancha/reto/${p.user_id}`)}>
                Retar <Swords className="h-4 w-4" />
              </Button>
            </div>
          </article>
        ))}
      </main>

      <BottomNav />
    </div>
  );
};

export default BuscarPartner;
