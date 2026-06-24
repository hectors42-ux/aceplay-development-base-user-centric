import { Link, useNavigate } from "react-router-dom";
import { ChevronLeft, Clock, MapPin, Megaphone, Plus, Swords, Loader2 } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/avatar/UserAvatar";
import { useAuth } from "@/components/providers/AuthProvider";
import { useActiveSport } from "@/components/providers/SportProvider";
import { useUserProfileSummary } from "@/hooks/useUserProfileSummary";
import { useAvailabilityFeed, useTakeAvailability, useWithdrawAvailability, type FeedCall } from "@/hooks/useCancha";
import { matchPct, formatSlot } from "@/lib/cancha-utils";
import { cn } from "@/lib/utils";

const Llamados = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { ratingSport } = useActiveSport();
  const { data: me } = useUserProfileSummary(user?.id ?? null, ratingSport);
  const { data: feed = [], isLoading } = useAvailabilityFeed();
  const take = useTakeAvailability();
  const withdraw = useWithdrawAvailability();

  const onTake = (call: FeedCall) =>
    take.mutate(call.id, { onSuccess: () => navigate("/cancha") });

  return (
    <div className="min-h-screen bg-background">
      <header className="safe-top sticky top-0 z-30 bg-background/80 px-5 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center gap-2">
          <Link to="/cancha" aria-label="Volver" className="grid h-9 w-9 place-items-center rounded-full hover:bg-muted">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h1 className="font-display text-lg font-bold tracking-tight text-foreground">Llamados a jugar</h1>
          <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-action/40 bg-action/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-action">
            <span className="h-1.5 w-1.5 rounded-full bg-action motion-safe:animate-pulse" /> En vivo
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-md space-y-3 px-5 pb-32 pt-2">
        <p className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Quien publica disponibilidad — <span className="font-semibold text-foreground">tómalo primero</span>.</span>
          <span className="font-semibold text-action">{feed.length} activos</span>
        </p>

        {isLoading && <div className="h-32 animate-pulse rounded-2xl border border-border bg-card/60" aria-hidden />}
        {!isLoading && feed.length === 0 && (
          <p className="rounded-2xl border border-border bg-card/60 px-4 py-8 text-center text-sm text-muted-foreground">
            No hay llamados activos. ¡Lanza el tuyo y rompe el hielo!
          </p>
        )}

        {feed.map((c) => {
          const pct = matchPct(me?.rating?.level, c.poster_nivel);
          const firstSlot = c.slots?.[0] ?? null;
          return (
            <article
              key={c.id}
              className={cn(
                "space-y-3 rounded-2xl border bg-card p-4 shadow-card",
                c.is_mine ? "border-skill/40 ring-1 ring-skill/15" : "border-border",
              )}
            >
              <div className="flex items-start gap-3">
                <span className="block shrink-0 rounded-full ring-2 ring-skill/40">
                  <UserAvatar kind={c.avatar_kind} look={c.avatar_look} url={c.avatar_url} name={c.name ?? "Jugador"} className="h-11 w-11" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-display text-sm font-bold text-foreground">
                      {c.is_mine ? "Tú" : c.name ?? "Jugador"}
                    </p>
                    {c.poster_nivel != null && (
                      <span className="shrink-0 rounded-full bg-skill/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-skill">
                        Niv {Number(c.poster_nivel).toFixed(0)}
                      </span>
                    )}
                    {!c.is_mine && (
                      <span className="shrink-0 rounded-full border border-info/30 bg-info/10 px-2 py-0.5 text-[10px] font-bold text-info">
                        {c.scope === "zone" ? `Tu Zona · ${pct}%` : "Abierto"}
                      </span>
                    )}
                  </div>
                  {c.note && <p className="truncate text-xs italic text-muted-foreground">"{c.note}"</p>}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-border/60 bg-background/40 px-3 py-2 text-xs">
                <span className="flex items-center gap-1 font-semibold text-action">
                  <Clock className="h-3.5 w-3.5" /> {formatSlot(firstSlot)}
                </span>
                <span className="flex items-center gap-1 text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" /> {c.space_name ?? "lugar a coordinar"}
                </span>
              </div>

              {c.is_mine ? (
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">Tu llamado · abierto · {c.taken_by ? "1 tomó" : "0 tomaron"}</span>
                  <Button variant="outline" size="sm" disabled={withdraw.isPending} onClick={() => withdraw.mutate(c.id)}>
                    Retirar
                  </Button>
                </div>
              ) : (
                <Button variant="clay" size="lg" className="w-full gap-1" disabled={take.isPending} onClick={() => onTake(c)}>
                  Tomar este partido <Swords className="h-4 w-4" />
                </Button>
              )}
            </article>
          );
        })}
      </main>

      {/* FAB: lanzar mi disponibilidad */}
      <Button
        asChild
        className="fixed bottom-24 right-5 z-40 h-14 gap-1.5 rounded-full bg-gradient-clay px-5 text-primary-foreground shadow-clay"
      >
        <Link to="/cancha/disponibilidad">
          <Megaphone className="h-5 w-5" /> Lanzar
        </Link>
      </Button>

      <BottomNav />
    </div>
  );
};

export default Llamados;
