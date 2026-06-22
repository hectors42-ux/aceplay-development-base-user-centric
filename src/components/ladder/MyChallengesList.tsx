import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  CalendarClock,
  Eye,
  Trophy,
  Hourglass,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/providers/AuthProvider";
import {
  LADDER_CHALLENGE_STATUS_LABEL,
  ladderChallengeStatusColor,
} from "@/lib/ladder-utils";
import type { ChallengeRow, LadderRow, ProfileLite } from "@/hooks/useLadderData";
import { ChallengeStatusSheet } from "./ChallengeStatusSheet";
import { ConfirmSlotDialog } from "./ConfirmSlotDialog";
import { LadderResultDialog } from "./LadderResultDialog";
import { AddToCalendarButton } from "@/components/shared/AddToCalendarButton";
import { ExternalBookingCTA } from "@/components/booking/ExternalBookingCTA";

interface Props {
  challenges: ChallengeRow[];
  profilesById: Record<string, ProfileLite>;
  ladder?: LadderRow | null;
  onChange?: () => void;
}

const fullName = (p?: ProfileLite) =>
  p ? `${p.first_name} ${p.last_name}`.trim() : "Jugador";

export const MyChallengesList = ({ challenges, profilesById, ladder, onChange }: Props) => {
  const { user } = useAuth();
  const [statusFor, setStatusFor] = useState<ChallengeRow | null>(null);
  const [confirmFor, setConfirmFor] = useState<ChallengeRow | null>(null);
  const [resultFor, setResultFor] = useState<ChallengeRow | null>(null);

  // Mostrar SOLO los que están en curso pero no requieren acción inmediata
  // del usuario (esos van en PendingChallengesList).
  const mine = useMemo(() => {
    if (!user) return [] as ChallengeRow[];
    return challenges
      .filter((c) => {
        const involved =
          c.challenger_user_id === user.id || c.challenged_user_id === user.id;
        if (!involved) return false;
        const isChallenger = c.challenger_user_id === user.id;
        // Si soy el desafiado y el desafío está pendiente de mi elección
        // ya aparece en "Por responder", lo omitimos aquí.
        if (!isChallenger && (c.status === "aceptado" || c.status === "propuesto")) {
          return false;
        }
        return ["propuesto", "aceptado", "programado"].includes(c.status);
      })
      .sort((a, b) => (a.expires_at < b.expires_at ? -1 : 1));
  }, [challenges, user]);

  if (!user) return null;
  if (mine.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border p-3 text-center text-[11px] text-muted-foreground">
        No tienes desafíos activos.
      </p>
    );
  }

  return (
    <>
      <ul className="space-y-2">
        {mine.map((c) => {
          const isChallenger = c.challenger_user_id === user.id;
          const opponent = profilesById[isChallenger ? c.challenged_user_id : c.challenger_user_id];
          const myPos = isChallenger ? c.challenger_position : c.challenged_position;
          const oppPos = isChallenger ? c.challenged_position : c.challenger_position;
          const waitingForRival = isChallenger && c.status === "aceptado";
          const isScheduled = c.status === "programado" && c.scheduled_at;
          const matchInPast =
            isScheduled && c.scheduled_at && parseISO(c.scheduled_at) < new Date();

          return (
            <li
              key={c.id}
              className="rounded-2xl border border-border bg-card p-3 shadow-card"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground">
                    {isChallenger ? "Desafías a" : "Te desafía"}
                  </p>
                  <p className="font-display text-sm font-semibold truncate">
                    {fullName(opponent)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Tú #{myPos} → vs #{oppPos}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${ladderChallengeStatusColor(c.status)}`}
                >
                  {LADDER_CHALLENGE_STATUS_LABEL[c.status]}
                </span>
              </div>

              {c.scheduled_at && (
                <p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
                  <CalendarClock className="h-3 w-3" />
                  {format(parseISO(c.scheduled_at), "EEE d MMM, HH:mm 'h'", { locale: es })}
                </p>
              )}
              {!c.scheduled_at && c.status !== "jugado" && (
                <p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Hourglass className="h-3 w-3" />
                  Vence {format(parseISO(c.expires_at), "d MMM HH:mm", { locale: es })}
                </p>
              )}

              {waitingForRival && (
                <p className="mt-2 rounded-xl bg-muted/50 px-2 py-1.5 text-[11px] text-muted-foreground">
                  Esperando que {fullName(opponent).split(" ")[0]} elija uno de tus 3 horarios.
                </p>
              )}

              {isScheduled && !matchInPast && (
                <div className="mt-3 space-y-2">
                  <AddToCalendarButton
                    title={`Escalerilla vs ${fullName(opponent)}`}
                    description={`Desafío ${ladder?.name ?? "Escalerilla"} · #${myPos} vs #${oppPos}`}
                    startsAt={c.scheduled_at!}
                    endsAt={new Date(parseISO(c.scheduled_at!).getTime() + 90 * 60 * 1000)}
                    filename={`piramide-${c.id}.ics`}
                    className="w-full"
                  />
                  <ExternalBookingCTA
                    source="card"
                    matchKind="ladder_challenge"
                    refId={c.id}
                    fullWidth
                    variant="outline"
                  />
                </div>
              )}

              {matchInPast && c.status === "programado" && !c.winner_user_id && (
                <div className="mt-3 flex gap-2">
                  <Button
                    variant="clay"
                    size="sm"
                    className="flex-1 gap-1.5"
                    onClick={() => setResultFor(c)}
                  >
                    <Trophy className="h-3.5 w-3.5" /> Cargar resultado
                  </Button>
                </div>
              )}

              <button
                type="button"
                onClick={() => setStatusFor(c)}
                className="mt-2 flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
              >
                <Eye className="h-3 w-3" /> Ver estado
              </button>
            </li>
          );
        })}
      </ul>

      {statusFor && (
        <ChallengeStatusSheet
          open={!!statusFor}
          onOpenChange={(o) => !o && setStatusFor(null)}
          challenge={statusFor}
          opponent={
            profilesById[
              statusFor.challenger_user_id === user.id
                ? statusFor.challenged_user_id
                : statusFor.challenger_user_id
            ]
          }
          isChallenger={statusFor.challenger_user_id === user.id}
          responseWindowHours={ladder?.response_window_hours ?? 48}
          challengeWindowDays={ladder?.challenge_window_days ?? 7}
        />
      )}

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

      {resultFor && (
        <LadderResultDialog
          challenge={resultFor}
          opponent={
            profilesById[
              resultFor.challenger_user_id === user.id
                ? resultFor.challenged_user_id
                : resultFor.challenger_user_id
            ]
          }
          onClose={() => setResultFor(null)}
          onSubmitted={() => {
            setResultFor(null);
            onChange?.();
          }}
        />
      )}
    </>
  );
};
