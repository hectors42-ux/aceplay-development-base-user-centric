import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Globe, Lock, Network, ChevronRight } from "lucide-react";

export type SpaceLike = {
  id: string;
  name: string;
  type: string;
  visibility: string;
  sport: string | null;
};

const typeLabel: Record<string, string> = {
  club: "Club",
  tournament: "Torneo",
  category: "Categoría",
  escalerilla: "Escalerilla",
  liga: "Liga",
  hierarchy: "Jerarquía",
};

const sportLabel: Record<string, string> = {
  tennis: "Tenis",
  padel: "Pádel",
};

function VisibilityIcon({ v }: { v: string }) {
  if (v === "public") return <Globe className="h-3.5 w-3.5" aria-label="público" />;
  if (v === "hierarchy") return <Network className="h-3.5 w-3.5" aria-label="por herencia" />;
  return <Lock className="h-3.5 w-3.5" aria-label="solo miembros" />;
}

export function SpaceCard({
  space,
  role,
  parentName,
  to,
  rightSlot,
}: {
  space: SpaceLike;
  role?: string | null;
  parentName?: string | null;
  to?: string;
  rightSlot?: React.ReactNode;
}) {
  const body = (
    <Card className="group relative overflow-hidden border-border/70 bg-gradient-to-br from-card via-card to-primary/5 p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="clay" className="rounded-md px-1.5 py-0 text-[10px] font-semibold uppercase tracking-wide">
              {typeLabel[space.type] ?? space.type}
            </Badge>
            {role && role !== "player" && (
              <Badge variant="olive" className="rounded-md px-1.5 py-0 text-[10px] font-semibold uppercase tracking-wide">
                {role}
              </Badge>
            )}
            <span className="inline-flex items-center text-muted-foreground/70">
              <VisibilityIcon v={space.visibility} />
            </span>
          </div>
          <p className="mt-2 truncate font-display text-lg leading-tight text-foreground">
            {space.name}
          </p>
          <div className="mt-1 flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {space.sport && <span>{sportLabel[space.sport] ?? space.sport}</span>}
            {parentName && (
              <>
                <span className="opacity-50">·</span>
                <span className="normal-case tracking-normal">en {parentName}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {rightSlot}
          {to && !rightSlot && (
            <ChevronRight className="h-4 w-4 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
          )}
        </div>
      </div>
    </Card>
  );
  return to ? (
    <Link to={to} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}