import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Globe, Lock, Network } from "lucide-react";

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
    <Card className="flex items-center justify-between gap-3 p-4 transition-colors hover:bg-muted/40">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="secondary" className="rounded-md px-1.5 py-0 text-[10px]">
            {typeLabel[space.type] ?? space.type}
          </Badge>
          {space.sport && <span className="capitalize">{space.sport}</span>}
          <VisibilityIcon v={space.visibility} />
        </div>
        <p className="mt-1 truncate font-display text-base">{space.name}</p>
        {parentName && (
          <p className="truncate text-xs text-muted-foreground">en {parentName}</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        {role && role !== "player" && (
          <Badge className="rounded-md text-[10px]">{role}</Badge>
        )}
        {rightSlot}
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