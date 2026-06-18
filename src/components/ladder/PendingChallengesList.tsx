import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarClock, Inbox, Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/providers/AuthProvider";
import type { ChallengeRow, ProfileLite } from "@/hooks/useLadderData";
import { ConfirmSlotDialog } from "./ConfirmSlotDialog";

interface Props {
  challenges: ChallengeRow[];
  profilesById: Record<string, ProfileLite>;
  onChange?: () => void;
}

const fullName = (p?: ProfileLite) =>
  p ? `${p.first_name} ${p.last_name}`.trim() : "Jugador";

/**
 * "Por responder": desafíos donde el usuario es el desafiado y debe elegir
 * uno de los 3 horarios propuestos por el retador (estado 'aceptado').
 */
export const PendingChallengesList = ({ challenges, profilesById, onChange }: Props) => {
  const { user } = useAuth();
  const [confirmFor, setConfirmFor] = useState<ChallengeRow | null>(null);

  const pending = useMemo(() => {
    if (!user) return [] as ChallengeRow[];
    return challenges
      .filter(
        (c) =>
          c.challenged_user_id === user.id &&
          (c.status === "aceptado" || c.status === "propuesto"),
      )
      .sort((a, b) => (a.expires_at < b.expires_at ? -1 : 1));
  }, [challenges, user]);

  if (!user || pending.length === 0) return null;

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2 px-1">
        <Inbox className="h-3.5 w-3.5 text-primary" />
        <h3 className="text-xs font-semibold uppercase tracking-wide text-primary">
          Por responder ({pending.length})
        </h3>
      </div>
      <ul className="space-y-2">
        {pending.map((c) => {
          const opponent = profilesById[c.challenger_user_id];
          return (
            <li
              key={c.id}
              className="rounded-2xl border border-primary/40 bg-primary/5 p-3 shadow-clay"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-wider text-primary">
                    Te desafía
                  </p>
                  <p className="font-display text-sm font-semibold">{fullName(opponent)}</p>
                  <p className="text-[11px] text-muted-foreground">
                    #{c.challenger_position} → vs Tú #{c.challenged_position}
                  </p>
                </div>
                <span className="shrink-0 rounded-full border border-primary/40 bg-card px-2 py-0.5 text-[10px] font-medium text-primary">
                  Elige horario
                </span>
              </div>

              <p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
                <CalendarClock className="h-3 w-3" />
                Vence {format(parseISO(c.expires_at), "EEE d MMM HH:mm", { locale: es })}
              </p>

              <Button
                variant="clay"
                size="sm"
                className="mt-3 w-full gap-1.5"
                onClick={() => setConfirmFor(c)}
              >
                <Swords className="h-3.5 w-3.5" /> Ver y elegir horario
              </Button>
            </li>
          );
        })}
      </ul>

      {confirmFor && (
        <ConfirmSlotDialog
          open={!!confirmFor}
          onOpenChange={(o) => !o && setConfirmFor(null)}
          challengeId={confirmFor.id}
          onConfirmed={() => {
            setConfirmFor(null);
            onChange?.();
          }}
        />
      )}
    </section>
  );
};
