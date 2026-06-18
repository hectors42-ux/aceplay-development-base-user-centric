import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CalendarDays, Compass, Sparkles, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SpaceCard, type SpaceLike } from "@/components/SpaceCard";
import { SectionHeader } from "@/components/SectionHeader";
import { EmptyState } from "@/components/EmptyState";

type Row = { role: string; space: SpaceLike };

function greeting() {
  const h = new Date().getHours();
  if (h < 6) return "Buenas noches";
  if (h < 13) return "Buenos días";
  if (h < 20) return "Buenas tardes";
  return "Buenas noches";
}

export default function Inicio() {
  const { user, profile } = useAuth();

  useEffect(() => {
    document.title = "Inicio · AcePlay";
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["my-spaces-home", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("space_membership")
        .select("role, space:space_id(id, name, type, visibility, sport)")
        .eq("player_id", user!.id)
        .eq("status", "active");
      if (error) throw error;
      return ((data ?? []).filter((r) => r.space) as unknown) as Row[];
    },
  });

  const rows = data ?? [];
  const top = rows.slice(0, 3);
  const firstName = (profile?.display_name ?? "").split(" ")[0];

  return (
    <div className="space-y-7">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-primary/15 bg-gradient-to-br from-primary/10 via-card to-card p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-primary">
              {greeting()}
            </p>
            <h1 className="mt-1 font-display text-3xl leading-tight text-foreground">
              Hola, <span className="italic text-primary">{firstName || "jugador"}</span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isLoading
                ? "Cargando tu cancha…"
                : rows.length === 0
                  ? "Aún no estás en competencias. Empieza explorando."
                  : `Estás en ${rows.length} ${rows.length === 1 ? "espacio activo" : "espacios activos"}.`}
            </p>
          </div>
          <Avatar className="h-14 w-14 ring-2 ring-primary/30">
            {profile?.avatar_url && <AvatarImage src={profile.avatar_url} />}
            <AvatarFallback className="bg-primary/10 font-display text-base text-primary">
              {(profile?.display_name ?? "?").slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild size="sm" className="rounded-full">
            <Link to="/compite">
              <Trophy className="mr-1.5 h-4 w-4" />
              Mis competencias
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline" className="rounded-full">
            <Link to="/descubrir">
              <Compass className="mr-1.5 h-4 w-4" />
              Descubrir
            </Link>
          </Button>
        </div>
      </section>

      {/* Tus competencias */}
      <section>
        <SectionHeader
          eyebrow="Player"
          title="Tus competencias"
          action={
            rows.length > 3 && (
              <Link
                to="/compite"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                Ver todas <ArrowRight className="h-3 w-3" />
              </Link>
            )
          }
        />
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-24 w-full rounded-2xl" />
          </div>
        ) : top.length === 0 ? (
          <EmptyState
            icon={Compass}
            title="Tu cancha está vacía"
            description="Únete a un club, torneo o escalerilla para empezar a competir."
            action={
              <Button asChild>
                <Link to="/descubrir">Explorar espacios</Link>
              </Button>
            }
          />
        ) : (
          <div className="space-y-2">
            {top.map((r) => (
              <SpaceCard key={r.space.id} space={r.space} role={r.role} to={`/space/${r.space.id}`} />
            ))}
          </div>
        )}
      </section>

      {/* Teasers */}
      <section className="grid gap-3 sm:grid-cols-2">
        <Card className="relative overflow-hidden border-dashed border-primary/20 bg-gradient-to-br from-card to-primary/5 p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-muted-foreground">
                Tu nivel
              </p>
              <p className="mt-1 font-display text-lg leading-tight">Aún sin partidos oficiales</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Verás tu rating cuando juegues tu primer partido en un espacio.
              </p>
            </div>
          </div>
          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-primary/10">
            <div className="h-full w-1/5 animate-shimmer rounded-full bg-primary/30" />
          </div>
        </Card>

        <Card className="relative overflow-hidden border-dashed border-accent/30 bg-gradient-to-br from-card to-accent/5 p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/15 text-accent">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-muted-foreground">
                Próximos partidos
              </p>
              <p className="mt-1 font-display text-lg leading-tight">Nada agendado aún</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Cuando un organizador te emparente, lo verás aquí.
              </p>
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
}