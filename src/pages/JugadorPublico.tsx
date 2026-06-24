import { Link, useParams } from "react-router-dom";
import { ChevronLeft, Swords, ShieldCheck, Trophy, Swords as SwordsIcon } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/avatar/UserAvatar";
import { useAuth } from "@/components/providers/AuthProvider";
import { useActiveSport } from "@/components/providers/SportProvider";
import { useUserProfileSummary } from "@/hooks/useUserProfileSummary";
import { usePublicProfile } from "@/hooks/useCancha";
import { matchPct } from "@/lib/cancha-utils";

const JugadorPublico = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { ratingSport } = useActiveSport();
  const { data: me } = useUserProfileSummary(user?.id ?? null, ratingSport);
  const { data: p, isLoading } = usePublicProfile(id);

  const pct = matchPct(me?.rating?.level, p?.nivel);
  const isSelf = id === user?.id;

  return (
    <div className="min-h-screen bg-background">
      <header className="safe-top sticky top-0 z-30 bg-background/80 px-5 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center gap-2">
          <button onClick={() => history.back()} aria-label="Volver" className="grid h-9 w-9 place-items-center rounded-full hover:bg-muted">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h1 className="font-display text-lg font-bold tracking-tight text-foreground">Perfil</h1>
        </div>
      </header>

      <main className="mx-auto max-w-md space-y-4 px-5 pb-28 pt-2">
        {isLoading && <div className="h-64 animate-pulse rounded-[22px] border border-border bg-card/60" aria-hidden />}

        {!isLoading && !p && (
          <p className="rounded-2xl border border-border bg-card/60 px-4 py-8 text-center text-sm text-muted-foreground">
            No encontramos este perfil.
          </p>
        )}

        {p && (
          <>
            {/* Identidad */}
            <section className="flex flex-col items-center text-center">
              <span className="block rounded-full ring-2 ring-skill/50">
                <UserAvatar kind={p.avatar_kind} look={p.avatar_look} url={p.avatar_url} name={p.name ?? "Jugador"} className="h-24 w-24" />
              </span>
              <h2 className="mt-3 font-display text-2xl font-bold text-foreground">{p.name ?? "Jugador"}</h2>
              <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
                {p.show_ranking && p.nivel != null && (
                  <span className="rounded-full border border-skill/30 bg-skill/10 px-3 py-1 text-xs font-bold text-skill">
                    {p.category ?? "—"} · Niv {Number(p.nivel).toFixed(0)}
                  </span>
                )}
                {!isSelf && (
                  <span className="rounded-full border border-skill/30 bg-skill/10 px-3 py-1 text-xs font-bold text-skill">
                    {pct}% match contigo
                  </span>
                )}
              </div>
            </section>

            {/* Cuenta de menor: perfil protegido (Addendum D · is_minor manda). */}
            {p.is_minor && (
              <div className="flex items-center gap-2 rounded-2xl border border-info/30 bg-info/[0.06] px-4 py-3">
                <ShieldCheck className="h-4 w-4 shrink-0 text-info" />
                <p className="text-xs text-muted-foreground">
                  Perfil protegido: es una cuenta de menor. Sus estadísticas no son públicas (Ley 21.719).
                </p>
              </div>
            )}

            {/* Estadísticas gateadas por privacidad (el RPC ya las anula si no aplican). */}
            {!p.is_minor && (p.show_record || p.show_head_to_head) && (
              <section className="grid grid-cols-2 gap-3">
                {p.show_record && p.matches_played != null && (
                  <div className="rounded-2xl border border-border bg-card p-4 text-center shadow-card">
                    <p className="flex items-center justify-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      <Trophy className="h-3 w-3" /> Partidos
                    </p>
                    <p className="mt-1 font-display text-2xl font-black text-foreground tabular-nums">{p.matches_played}</p>
                  </div>
                )}
                {p.show_head_to_head && !isSelf && (
                  <div className="rounded-2xl border border-border bg-card p-4 text-center shadow-card">
                    <p className="flex items-center justify-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      <SwordsIcon className="h-3 w-3" /> Cara a cara
                    </p>
                    <p className="mt-1 font-display text-lg font-black tabular-nums">
                      <span className="text-skill">{p.h2h_wins ?? 0}</span>
                      <span className="text-muted-foreground"> – </span>
                      <span className="text-foreground">{p.h2h_losses ?? 0}</span>
                    </p>
                    <p className="text-[10px] text-muted-foreground">tú – {p.name?.split(" ")[0] ?? "rival"}</p>
                  </div>
                )}
              </section>
            )}

            {/* CTA Retar (no para uno mismo). */}
            {!isSelf && (
              <Button asChild variant="clay" size="lg" className="w-full gap-1">
                <Link to={`/cancha/reto/${p.user_id}`}>
                  Retar <Swords className="h-4 w-4" />
                </Link>
              </Button>
            )}
          </>
        )}
      </main>

      <BottomNav />
    </div>
  );
};

export default JugadorPublico;
