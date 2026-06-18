import { useState } from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarClock, Check, MapPin, X, Loader2, ShieldCheck, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AddToCalendarButton } from "@/components/shared/AddToCalendarButton";
import { useAuth } from "@/components/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import {
  Court,
  Match,
  Player,
  Registration,
  RescheduleRequest,
  ResultProposal,
  registrationLabel,
} from "@/hooks/useCategoryData";
import {
  formatScore,
  matchStatusColor,
  MATCH_STATUS_LABEL,
  roundLabel,
  totalRoundsForMatches,
} from "@/lib/tournament-utils";

interface MatchListProps {
  matches: Match[];
  registrations: Registration[];
  players: Map<string, Player>;
  courts: Court[];
  pendingResults: ResultProposal[];
  pendingReschedules: RescheduleRequest[];
  onSchedule: (m: Match) => void;
  onResult: (m: Match) => void;
  onReschedule: (m: Match) => void;
  onCorrect?: (m: Match) => void;
  onChanged: () => void;
  isAdmin: boolean;
  rescheduleEnabled: boolean;
  emptyText?: string;
}

export const MatchList = ({
  matches,
  registrations,
  players,
  courts,
  pendingResults,
  pendingReschedules,
  onSchedule,
  onResult,
  onReschedule,
  onCorrect,
  onChanged,
  isAdmin,
  rescheduleEnabled,
  emptyText,
}: MatchListProps) => {
  const { user } = useAuth();
  const [busyId, setBusyId] = useState<string | null>(null);
  const totalRounds = totalRoundsForMatches(matches);
  const courtsById = new Map(courts.map((c) => [c.id, c]));
  const regsById = new Map(registrations.map((r) => [r.id, r]));

  if (matches.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border bg-card/50 p-6 text-center text-sm text-muted-foreground">
        {emptyText ?? "Sin partidos."}
      </p>
    );
  }

  const isUserInMatch = (m: Match) => {
    if (!user) return false;
    const a = m.registration_a_id ? regsById.get(m.registration_a_id) : undefined;
    const b = m.registration_b_id ? regsById.get(m.registration_b_id) : undefined;
    return [a?.player1_user_id, a?.player2_user_id, b?.player1_user_id, b?.player2_user_id].includes(user.id);
  };

  const confirmResult = async (proposalId: string) => {
    setBusyId(proposalId);
    const { error } = await supabase.rpc("confirm_match_result", { _proposal_id: proposalId });
    setBusyId(null);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Resultado confirmado" });
    onChanged();
  };

  const rejectResult = async (proposalId: string) => {
    const reason = prompt("Motivo del rechazo (opcional):") ?? undefined;
    setBusyId(proposalId);
    const { error } = await supabase.rpc("reject_match_result", {
      _proposal_id: proposalId,
      _reason: reason,
    });
    setBusyId(null);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Resultado rechazado" });
    onChanged();
  };

  const respondReschedule = async (id: string, accept: boolean) => {
    setBusyId(id);
    const { error } = await supabase.rpc("respond_match_reschedule", {
      _request_id: id,
      _accept: accept,
    });
    setBusyId(null);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: accept ? "Reagendamiento aceptado" : "Reagendamiento rechazado" });
    onChanged();
  };

  const acceptMatch = async (matchId: string) => {
    setBusyId(matchId);
    const { error } = await supabase.rpc("accept_tournament_match", { _match_id: matchId });
    setBusyId(null);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Partido aceptado", description: "Esperando confirmación del rival si aplica." });
    onChanged();
  };

  const rejectMatch = async (matchId: string) => {
    const reason = prompt("Motivo (opcional):") ?? undefined;
    setBusyId(matchId);
    const { error } = await supabase.rpc("reject_tournament_match", {
      _match_id: matchId,
      _reason: reason,
    });
    setBusyId(null);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Partido devuelto a pendiente", description: "El admin podrá reasignar." });
    onChanged();
  };

  return (
    <div className="space-y-3">
      {matches.map((m) => {
        const regA = m.registration_a_id ? regsById.get(m.registration_a_id) : undefined;
        const regB = m.registration_b_id ? regsById.get(m.registration_b_id) : undefined;
        const userInMatch = isUserInMatch(m);
        const proposal = pendingResults.find((p) => p.match_id === m.id);
        const reschedule = pendingReschedules.find((p) => p.match_id === m.id);
        const proposalIsMine = proposal && user && proposal.proposed_by === user.id;
        const rescheduleIsMine = reschedule && user && reschedule.proposed_by === user.id;
        const canPlay = !!(regA && regB) && m.status !== "jugado" && m.status !== "walkover" && m.status !== "cancelado";
        const canSchedule = canPlay && isAdmin;
        // Determinar el "lado" del usuario para saber qué aceptación le corresponde
        const userInA = !!user && (regA?.player1_user_id === user.id || regA?.player2_user_id === user.id);
        const userInB = !!user && (regB?.player1_user_id === user.id || regB?.player2_user_id === user.id);
        const mySide: "a" | "b" | null = userInA ? "a" : userInB ? "b" : null;
        const myAcceptance = mySide === "a" ? m.acceptance_a : mySide === "b" ? m.acceptance_b : null;
        const rivalAcceptance = mySide === "a" ? m.acceptance_b : mySide === "b" ? m.acceptance_a : null;
        const isScheduledNotConfirmed =
          !!m.scheduled_at && m.status === "programado" && (m.acceptance_a !== "accepted" || m.acceptance_b !== "accepted");
        const canPlayerAccept = canPlay && userInMatch && isScheduledNotConfirmed && myAcceptance !== "accepted";
        const canPlayerReport = canPlay && userInMatch && !proposal;
        const canPlayerReschedule =
          canPlay &&
          userInMatch &&
          rescheduleEnabled &&
          !reschedule &&
          m.scheduled_at &&
          !m.reschedule_used;
        const court = m.court_id ? courtsById.get(m.court_id) : undefined;
        const busy = busyId === m.id || busyId === proposal?.id || busyId === reschedule?.id;

        return (
          <div
            key={m.id}
            className={`rounded-3xl border bg-card p-4 shadow-card ${userInMatch ? "border-primary/60 ring-1 ring-primary/30" : "border-border"}`}
          >
            <div className="mb-2 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {roundLabel(m.round, totalRounds)} · partido {m.bracket_position}
                </p>
                <p className="text-sm font-medium">{registrationLabel(regA, players)}</p>
                <p className="text-xs text-muted-foreground">vs</p>
                <p className="text-sm font-medium">{registrationLabel(regB, players)}</p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${matchStatusColor(m.status)}`}
              >
                {MATCH_STATUS_LABEL[m.status]}
              </span>
            </div>

            {(m.scheduled_at || court) && (
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                {m.scheduled_at && (
                  <span className="flex items-center gap-1">
                    <CalendarClock className="h-3.5 w-3.5" />
                    {format(parseISO(m.scheduled_at), "EEE d MMM HH:mm", { locale: es })}
                  </span>
                )}
                {court && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {court.name}
                  </span>
                )}
                {isScheduledNotConfirmed && (
                  <span className="flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-amber-700 dark:text-amber-400">
                    <AlertCircle className="h-3 w-3" /> Esperando aceptación
                  </span>
                )}
                {!isScheduledNotConfirmed && m.scheduled_at && m.accepted_at && (
                  <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                    <ShieldCheck className="h-3 w-3" /> Confirmado
                  </span>
                )}
                {m.reschedule_used && (
                  <span className="text-[10px] italic text-muted-foreground/70">
                    · cambio ya usado
                  </span>
                )}
              </div>
            )}

            {/* Bloque de aceptación de partido programado */}
            {canPlayerAccept && (
              <div className="mt-3 rounded-2xl border border-amber-500/40 bg-amber-500/5 p-3 text-xs">
                <p className="font-medium text-foreground">Confirma tu asistencia a este partido</p>
                <p className="mt-0.5 text-muted-foreground">
                  Tú: {String(myAcceptance ?? "pending") === "accepted" ? "aceptado" : String(myAcceptance ?? "pending") === "rejected" ? "rechazado" : "pendiente"} ·
                  {" "}Rival: {String(rivalAcceptance ?? "pending") === "accepted" ? "aceptado" : String(rivalAcceptance ?? "pending") === "rejected" ? "rechazado" : "pendiente"}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => acceptMatch(m.id)} disabled={busy}>
                    {busy && busyId === m.id ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Check className="mr-1 h-3 w-3" />}
                    Aceptar
                  </Button>
                  {!m.reschedule_used && rescheduleEnabled && (
                    <Button size="sm" variant="outline" onClick={() => onReschedule(m)} disabled={busy}>
                      Solicitar cambio
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => rejectMatch(m.id)} disabled={busy}>
                    <X className="mr-1 h-3 w-3" /> Rechazar
                  </Button>
                </div>
              </div>
            )}

            {m.score && (
              <p className="mt-2 text-xs font-medium">
                Resultado: {formatScore(m.score)}
                {m.walkover && " · W.O."}
                {m.retired && " · Retiro"}
              </p>
            )}

            {proposal && (
              <div className="mt-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
                <p className="font-medium">
                  Resultado propuesto: {formatScore(proposal.score)}
                  {proposal.walkover && " · W.O."}
                </p>
                <p className="text-muted-foreground">
                  Ganador: {registrationLabel(regsById.get(proposal.winner_registration_id), players)}
                </p>
                {!proposalIsMine && userInMatch && (
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" onClick={() => confirmResult(proposal.id)} disabled={busy}>
                      <Check className="mr-1 h-3 w-3" /> Confirmar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => rejectResult(proposal.id)} disabled={busy}>
                      <X className="mr-1 h-3 w-3" /> Rechazar
                    </Button>
                  </div>
                )}
                {isAdmin && (
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" onClick={() => confirmResult(proposal.id)} disabled={busy}>
                      Aprobar (admin)
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => rejectResult(proposal.id)} disabled={busy}>
                      Rechazar
                    </Button>
                  </div>
                )}
                {proposalIsMine && (
                  <p className="mt-1 text-muted-foreground">Esperando confirmación del rival.</p>
                )}
              </div>
            )}

            {reschedule && (
              <div className="mt-3 rounded-2xl border border-primary/30 bg-primary/5 p-3 text-xs">
                <p className="font-medium">Propuesta de reagendamiento</p>
                <p className="text-muted-foreground">
                  Nuevo horario:{" "}
                  {format(parseISO(reschedule.proposed_starts_at), "EEE d MMM HH:mm", { locale: es })}
                  {reschedule.proposed_court_id &&
                    ` · ${courtsById.get(reschedule.proposed_court_id)?.name ?? "cancha"}`}
                </p>
                {!rescheduleIsMine && userInMatch && (
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" onClick={() => respondReschedule(reschedule.id, true)} disabled={busy}>
                      Aceptar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => respondReschedule(reschedule.id, false)} disabled={busy}>
                      Rechazar
                    </Button>
                  </div>
                )}
                {rescheduleIsMine && (
                  <p className="mt-1 text-muted-foreground">Esperando respuesta del rival.</p>
                )}
              </div>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              {canSchedule && (
                <Button size="sm" variant="outline" onClick={() => onSchedule(m)}>
                  {m.scheduled_at ? "Reprogramar" : "Programar"}
                </Button>
              )}
              {canPlayerReport && (
                <Button size="sm" onClick={() => onResult(m)}>
                  Cargar resultado
                </Button>
              )}
              {isAdmin && canPlay && !proposal && (
                <Button size="sm" variant="outline" onClick={() => onResult(m)}>
                  Resultado (admin)
                </Button>
              )}
              {isAdmin && onCorrect && m.status === "jugado" && !m.walkover && (
                <Button size="sm" variant="outline" onClick={() => onCorrect(m)}>
                  Ajustar resultado
                </Button>
              )}
              {canPlayerReschedule && (
                <Button size="sm" variant="ghost" onClick={() => onReschedule(m)}>
                  Reagendar
                </Button>
              )}
              {m.scheduled_at && userInMatch && m.status !== "jugado" && m.status !== "cancelado" && (
                <AddToCalendarButton
                  title={`Partido vs ${mySide === "a" ? registrationLabel(regB, players) : registrationLabel(regA, players)}`}
                  description={`${roundLabel(m.round, totalRounds)} · partido ${m.bracket_position}`}
                  location={court?.name}
                  startsAt={m.scheduled_at}
                  endsAt={new Date(parseISO(m.scheduled_at).getTime() + 90 * 60 * 1000)}
                  filename={`partido-${m.id}.ics`}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
