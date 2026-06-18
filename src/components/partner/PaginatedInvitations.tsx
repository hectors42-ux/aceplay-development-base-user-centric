import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { InvitationItem } from "./InvitationItem";
import type { InvitationWithProfile } from "@/hooks/useMatchInvitations";

const PAGE = 10;

interface Props {
  items: InvitationWithProfile[];
  side: "received" | "sent";
  onChanged: () => void;
}

// Lista paginada para mantener fluidez con muchas invitaciones.
// Ordena pendientes primero y va cargando de a 10 con "Ver más".
export const PaginatedInvitations = ({ items, side, onChanged }: Props) => {
  const ordered = useMemo(() => {
    const pending = items.filter((i) => i.status === "pending");
    const rest = items.filter((i) => i.status !== "pending");
    return [...pending, ...rest];
  }, [items]);

  const [visible, setVisible] = useState(PAGE);
  const slice = ordered.slice(0, visible);
  const remaining = ordered.length - slice.length;

  return (
    <div className="space-y-2">
      {slice.map((i) => (
        <InvitationItem key={i.id} invitation={i} side={side} onChanged={onChanged} />
      ))}
      {remaining > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setVisible((v) => v + PAGE)}
          className="w-full text-xs text-muted-foreground"
        >
          Ver {Math.min(PAGE, remaining)} más ({remaining} restantes)
        </Button>
      )}
    </div>
  );
};
