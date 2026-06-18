import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { SpaceCard, type SpaceLike } from "@/components/SpaceCard";
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
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  const rows = data?.rows ?? [];
  if (!rows.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
        <p className="font-display text-xl">Aún no participas en ninguna competencia</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Explora en Descubrir o únete con un código.
        </p>
        <Button asChild className="mt-4">
          <Link to="/descubrir">Ir a Descubrir</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {sectionOrder.map(({ key, label }) => {
        const items = rows.filter((r) => r.space.type === key);
        if (!items.length) return null;
        return (
          <section key={key}>
            <h2 className="mb-2 px-1 text-xs font-medium uppercase tracking-widest text-muted-foreground">
              {label}
            </h2>
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