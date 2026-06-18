import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { SpaceCard } from "@/components/SpaceCard";
import { JoinButton } from "@/components/JoinButton";
import { EmptyState } from "@/components/EmptyState";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, SearchX } from "lucide-react";

type SpaceRow = {
  id: string;
  name: string;
  type: string;
  visibility: string;
  sport: string | null;
  join_policy: string;
  parent_space_id: string | null;
  settings: Record<string, unknown> | null;
};

export default function Descubrir() {
  const { user } = useAuth();
  const [q, setQ] = useState("");

  useEffect(() => {
    document.title = "Descubrir · AcePlay";
  }, []);

  const { data: spaces, isLoading } = useQuery({
    queryKey: ["discover"],
    queryFn: async () => {
      // RLS retorna también lo heredado por herencia visible. Pedimos amplio.
      const { data, error } = await supabase
        .from("space")
        .select("id, name, type, visibility, sport, join_policy, parent_space_id, settings")
        .in("type", ["tournament", "escalerilla", "liga", "category"])
        .order("created_at", { ascending: false })
        .limit(80);
      if (error) throw error;
      return (data ?? []) as unknown as SpaceRow[];
    },
  });

  const { data: myMemberships } = useQuery({
    queryKey: ["my-membership-ids", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("space_membership")
        .select("space_id, status")
        .eq("player_id", user!.id);
      return new Set((data ?? []).map((r) => r.space_id));
    },
  });

  const search = q.trim().toLowerCase();
  const filtered = (spaces ?? []).filter((s) => {
    if (!search) return true;
    return (
      s.name.toLowerCase().includes(search) ||
      (s.settings?.["code"] as string | undefined)?.toLowerCase() === search
    );
  });

  return (
    <div className="space-y-5">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-primary">Explorar</p>
        <h1 className="mt-1 font-display text-3xl leading-tight">Descubrir</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Únete a torneos, escalerillas y ligas. Busca por nombre o código.
        </p>
      </div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary/60" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Nombre o código…"
          className="h-11 rounded-full border-border/70 bg-card pl-10 shadow-sm"
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="Sin resultados"
          description="Prueba con otro nombre o pídele un código al organizador."
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((s) => {
            const already = myMemberships?.has(s.id);
            return (
              <SpaceCard
                key={s.id}
                space={s}
                to={`/space/${s.id}`}
                rightSlot={
                  already ? (
                    <span className="text-xs text-muted-foreground">Inscrito</span>
                  ) : (
                    <div onClick={(e) => e.preventDefault()}>
                      <JoinButton space={s} compact />
                    </div>
                  )
                }
              />
            );
          })}
        </div>
      )}
    </div>
  );
}