import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { JoinButton } from "@/components/JoinButton";
import { SpaceCard, type SpaceLike } from "@/components/SpaceCard";
import { Globe, Lock, Network } from "lucide-react";

type SpaceFull = SpaceLike & {
  join_policy: string;
  parent_space_id: string | null;
  organizer_id: string;
  settings: Record<string, unknown> | null;
};

type MemberRow = {
  role: string;
  status: string;
  player: { id: string; handle: string; display_name: string; avatar_url: string | null };
};

function visibilityIcon(v: string) {
  if (v === "public") return <Globe className="h-4 w-4" />;
  if (v === "hierarchy") return <Network className="h-4 w-4" />;
  return <Lock className="h-4 w-4" />;
}

export default function SpacePage() {
  const { id = "" } = useParams();
  const { user } = useAuth();

  const spaceQ = useQuery({
    queryKey: ["space", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("space")
        .select(
          "id, name, type, visibility, sport, join_policy, parent_space_id, organizer_id, settings",
        )
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as SpaceFull | null;
    },
  });

  const membersQ = useQuery({
    queryKey: ["space-members", id],
    enabled: !!spaceQ.data,
    queryFn: async () => {
      const { data } = await supabase
        .from("space_membership")
        .select(
          "role, status, player:player_id(id, handle, display_name, avatar_url)",
        )
        .eq("space_id", id)
        .in("status", ["active", "pending"]);
      return (data ?? []) as unknown as MemberRow[];
    },
  });

  const childrenQ = useQuery({
    queryKey: ["space-children", id],
    enabled: !!spaceQ.data && spaceQ.data.type === "club" && spaceQ.data.visibility === "hierarchy",
    queryFn: async () => {
      const { data } = await supabase
        .from("space")
        .select("id, name, type, visibility, sport, join_policy, parent_space_id, settings")
        .eq("parent_space_id", id);
      return (data ?? []) as unknown as Array<SpaceFull & { settings: Record<string, unknown> | null }>;
    },
  });

  const organizerQ = useQuery({
    queryKey: ["organizer", spaceQ.data?.organizer_id],
    enabled: !!spaceQ.data?.organizer_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("handle, display_name")
        .eq("id", spaceQ.data!.organizer_id)
        .maybeSingle();
      return data;
    },
  });

  const standingQ = useQuery({
    queryKey: ["my-standing", id, user?.id],
    enabled: !!user && !!spaceQ.data,
    queryFn: async () => {
      const { data } = await supabase
        .from("space_standing")
        .select("local_rank")
        .eq("space_id", id)
        .eq("player_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const adminQ = useQuery({
    queryKey: ["is-admin", id, user?.id],
    enabled: !!user && !!spaceQ.data,
    queryFn: async () => {
      const { data } = await supabase.rpc("space_admin", { p_space: id });
      return Boolean(data);
    },
  });

  useEffect(() => {
    if (spaceQ.data) document.title = `${spaceQ.data.name} · AcePlay`;
  }, [spaceQ.data]);

  if (spaceQ.isLoading) return <Skeleton className="h-40 w-full" />;

  if (spaceQ.error || !spaceQ.data) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-8 text-center">
        <p className="font-display text-xl">No tienes acceso a este espacio</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Pídele al organizador que te invite, o busca otro en Descubrir.
        </p>
        <Button asChild className="mt-4" variant="outline">
          <Link to="/descubrir">Descubrir</Link>
        </Button>
      </div>
    );
  }

  const space = spaceQ.data;
  const members = membersQ.data ?? [];
  const iAmMember = members.some((m) => m.player.id === user?.id && m.status === "active");
  const description = (space.settings?.["description"] as string | undefined) ?? null;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="secondary" className="rounded-md text-[10px]">
            {space.type}
          </Badge>
          {space.sport && <span className="capitalize">{space.sport}</span>}
          {visibilityIcon(space.visibility)}
        </div>
        <div className="flex items-start justify-between gap-3">
          <h1 className="font-display text-3xl leading-tight">{space.name}</h1>
          {!iAmMember && <JoinButton space={space} />}
        </div>
        {standingQ.data?.local_rank != null && (
          <p className="text-sm text-muted-foreground">
            Tu posición: <span className="font-medium text-foreground">#{standingQ.data.local_rank}</span>
          </p>
        )}
        {adminQ.data && (
          <Button variant="outline" size="sm" disabled>
            Gestionar · Próximamente
          </Button>
        )}
      </header>

      <Tabs defaultValue="participantes">
        <TabsList>
          <TabsTrigger value="participantes">Participantes</TabsTrigger>
          <TabsTrigger value="info">Info</TabsTrigger>
        </TabsList>
        <TabsContent value="participantes" className="mt-4">
          {membersQ.isLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : members.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nadie por aquí todavía.</p>
          ) : (
            <ul className="space-y-2">
              {members.map((m) => {
                const me = m.player.id === user?.id;
                return (
                  <li key={m.player.id}>
                    <Card
                      className={`flex items-center justify-between gap-3 p-3 ${
                        me ? "ring-2 ring-primary" : ""
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar className="h-9 w-9">
                          {m.player.avatar_url && <AvatarImage src={m.player.avatar_url} />}
                          <AvatarFallback className="text-[11px]">
                            {m.player.display_name?.slice(0, 2).toUpperCase() ?? "?"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {m.player.display_name} {me && <span className="text-xs text-muted-foreground">(tú)</span>}
                          </p>
                          <p className="truncate text-[11px] text-muted-foreground">@{m.player.handle}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {m.status === "pending" && (
                          <Badge variant="outline" className="rounded-md text-[10px]">
                            pendiente
                          </Badge>
                        )}
                        {m.role !== "player" && (
                          <Badge className="rounded-md text-[10px]">{m.role}</Badge>
                        )}
                      </div>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </TabsContent>
        <TabsContent value="info" className="mt-4 space-y-3 text-sm">
          {description && <p>{description}</p>}
          <p className="text-muted-foreground">
            Política de ingreso: <span className="text-foreground">{space.join_policy}</span>
          </p>
          {organizerQ.data && (
            <p className="text-muted-foreground">
              Organizador:{" "}
              <span className="text-foreground">
                {organizerQ.data.display_name} (@{organizerQ.data.handle})
              </span>
            </p>
          )}
        </TabsContent>
      </Tabs>

      {space.type === "club" && space.visibility === "hierarchy" && (
        <section>
          <h2 className="mb-2 px-1 text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Competencias del club
          </h2>
          {childrenQ.isLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : (childrenQ.data?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">Sin competencias activas aún.</p>
          ) : (
            <div className="space-y-2">
              {childrenQ.data!.map((c) => (
                <SpaceCard
                  key={c.id}
                  space={c}
                  to={`/space/${c.id}`}
                  rightSlot={
                    <div onClick={(e) => e.preventDefault()}>
                      <JoinButton space={c} compact />
                    </div>
                  }
                />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}