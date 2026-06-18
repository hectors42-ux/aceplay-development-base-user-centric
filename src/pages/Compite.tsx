import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Compass } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { SpaceCard, type SpaceLike } from "@/components/SpaceCard";
import { SectionHeader } from "@/components/SectionHeader";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

type Row = {
  role: string;
  space: SpaceLike & { parent_space_id: string | null };
};

const sectionOrder: Array<{ key: string; label: string }> = [
  { key: "club", label: "Clubes" },
  { key: "tournament", label: "Torneos" },
  { key: "category", label: "Categorías" },
  { key: "escalerilla", label: "Escalerillas" },
  { key: "liga", label: "Ligas" },
];

export default function Compite() {
  const { user } = useAuth();

  useEffect(() => {
    document.title = "Compite · AcePlay";
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["my-spaces", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("space_membership")
        .select(
          "role, status, space:space_id(id, name, type, visibility, sport, parent_space_id)",
        )
        .eq("player_id", user!.id)
        .eq("status", "active");
      if (error) throw error;
      const rows = (data ?? []).filter((r) => r.space) as unknown as Row[];
      // resolver nombres de torneo padre para categorías
      const catParents = rows
        .filter((r) => r.space.type === "category" && r.space.parent_space_id)
        .map((r) => r.space.parent_space_id as string);
      let parentMap: Record<string, string> = {};
      if (catParents.length) {
        const { data: parents } = await supabase
          .from("space")
          .select("id, name")
          .in("id", catParents);
        parentMap = Object.fromEntries((parents ?? []).map((p) => [p.id, p.name]));
      }
      return { rows, parentMap };
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
      </div>
    );
  }

  const rows = data?.rows ?? [];
  if (!rows.length) {
    return (
      <EmptyState
        icon={Compass}
        title="Aún no participas en ninguna competencia"
        description="Explora torneos abiertos o únete con un código."
        action={
          <Button asChild>
            <Link to="/descubrir">Ir a Descubrir</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-7">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-primary">Player</p>
        <h1 className="mt-1 font-display text-3xl leading-tight">Compite</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tus espacios activos, organizados por tipo.
        </p>
      </div>
      {sectionOrder.map(({ key, label }) => {
        const items = rows.filter((r) => r.space.type === key);
        if (!items.length) return null;
        return (
          <section key={key}>
            <SectionHeader eyebrow={`${items.length}`} title={label} />
            <div className="space-y-2">
              {items.map((r) => (
                <SpaceCard
                  key={r.space.id}
                  space={r.space}
                  role={r.role}
                  parentName={
                    r.space.type === "category" && r.space.parent_space_id
                      ? data?.parentMap[r.space.parent_space_id]
                      : null
                  }
                  to={`/space/${r.space.id}`}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}