import { useState } from "react";
import { Loader2, Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTournamentChallengeableOpponents } from "@/hooks/useTournamentChallengeableOpponents";
import { TournamentChallengeWithSlotsDialog } from "./TournamentChallengeWithSlotsDialog";

interface Props {
  categoryId: string;
  tenantId: string;
  onCreated?: () => void;
}

export const RoundRobinOpponents = ({ categoryId, tenantId, onCreated }: Props) => {
  const { data, isLoading, refetch } = useTournamentChallengeableOpponents(categoryId);
  const [target, setTarget] = useState<{ userId: string; name: string } | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border bg-muted/20 p-4 text-center text-xs text-muted-foreground">
        No tienes rivales pendientes en esta categoría.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {data.map((op) => (
        <div
          key={op.registration_id}
          className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{op.full_name ?? "Jugador"}</p>
            {op.has_open_challenge && (
              <p className="text-[11px] text-muted-foreground">Desafío pendiente</p>
            )}
          </div>
          <Button
            size="sm"
            variant="clay"
            disabled={op.has_open_challenge}
            onClick={() => setTarget({ userId: op.user_id, name: op.full_name ?? "Jugador" })}
          >
            <Swords className="mr-1 h-3.5 w-3.5" /> Desafiar
          </Button>
        </div>
      ))}

      <TournamentChallengeWithSlotsDialog
        open={!!target}
        onOpenChange={(o) => !o && setTarget(null)}
        tenantId={tenantId}
        categoryId={categoryId}
        opponentUserId={target?.userId ?? ""}
        opponentName={target?.name ?? ""}
        onCreated={() => {
          refetch();
          onCreated?.();
        }}
      />
    </div>
  );
};