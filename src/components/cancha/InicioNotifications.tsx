import { Link } from "react-router-dom";
import { Swords, Check, X, Megaphone, ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/avatar/UserAvatar";
import {
  useReceivedChallenges,
  useMatchAgenda,
  useCommunityCalls,
  useRespondChallenge,
  useTakeAvailability,
} from "@/hooks/useCancha";
import { formatSlot as fmtSlot } from "@/lib/cancha-utils";

// Notificaciones del Inicio (sección Cancha). Cada tarjeta usa el color de su capa:
//   · Reto recibido = NARANJA (acción) · Carga tu resultado = ORO · Llamado = AZUL.
// Solo leen y disparan RPCs de M1 (no premian). El estado "vencido_sin_resultado"
// llega por el fallback on-read de get_match_agenda (Addendum C, sin cron).

export function InicioNotifications() {
  const { data: received = [] } = useReceivedChallenges();
  const { data: agenda = [] } = useMatchAgenda();
  const { data: calls = [] } = useCommunityCalls();
  const respond = useRespondChallenge();
  const take = useTakeAvailability();

  const reto = received[0];
  const overdue = agenda.find((a) => a.state === "vencido_sin_resultado");
  const call = calls[0];

  if (!reto && !overdue && !call) return null;

  return (
    <section className="space-y-3 px-5" aria-label="Notificaciones de la cancha">
      {/* RETO RECIBIDO · naranja */}
      {reto && (
        <article className="rounded-2xl border border-action/40 bg-action/[0.06] p-4 shadow-card">
          <p className="mb-3 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-action">
            <Swords className="h-3.5 w-3.5" /> Te retaron
          </p>
          <div className="flex items-center gap-3">
            <UserAvatar
              kind={reto.from_profile?.avatar_kind}
              look={reto.from_profile?.avatar_look}
              url={reto.from_profile?.avatar_url}
              name={reto.from_profile?.display_name ?? "Rival"}
              className="h-11 w-11 shrink-0"
            />
            <div className="min-w-0">
              <p className="truncate font-display text-sm font-bold text-foreground">
                {reto.from_profile?.display_name ?? "Un rival"} te retó
              </p>
              <p className="truncate text-xs text-muted-foreground">
                Propone: {fmtSlot(reto.proposed_slots?.[0] ?? null)}
                {reto.space?.name ? ` · ${reto.space.name}` : ""} (referencial)
              </p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <Button
              variant="clay"
              size="sm"
              className="flex-1 gap-1"
              disabled={respond.isPending}
              onClick={() => respond.mutate({ id: reto.id, action: "accept" })}
            >
              Aceptar <Check className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              disabled
              title="Pronto: coordina día y hora (M3)"
            >
              Proponer otra
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Rechazar reto"
              disabled={respond.isPending}
              onClick={() => respond.mutate({ id: reto.id, action: "reject" })}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </article>
      )}

      {/* CARGA TU RESULTADO · oro */}
      {overdue && (
        <article className="rounded-2xl border border-fichas/40 bg-fichas/[0.06] p-4 shadow-card">
          <p className="mb-3 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-fichas">
            Tu partido ya pasó · falta el resultado
          </p>
          <div className="flex items-center gap-3">
            <UserAvatar
              kind={overdue.opponent_avatar_kind}
              look={overdue.opponent_avatar_look}
              url={overdue.opponent_avatar_url}
              name={overdue.opponent_name ?? "Rival"}
              className="h-11 w-11 shrink-0"
            />
            <div className="min-w-0">
              <p className="truncate font-display text-sm font-bold text-foreground">
                vs {overdue.opponent_name ?? "tu rival"}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {fmtSlot(overdue.slot)}
                {overdue.space_name ? ` · ${overdue.space_name}` : ""} · ¿quién ganó?
              </p>
            </div>
          </div>
          <Button
            asChild
            size="lg"
            className="mt-3 w-full gap-1 border border-fichas/40 bg-fichas text-[#211803] shadow-card hover:bg-fichas/90"
          >
            <Link to="/cargar">
              Cargar resultado <ArrowUp className="h-4 w-4" />
            </Link>
          </Button>
        </article>
      )}

      {/* LLAMADO DE COMUNIDAD · azul */}
      {call && (
        <article className="rounded-2xl border border-info/40 bg-info/[0.06] p-4 shadow-card">
          <p className="mb-3 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-info">
            <Megaphone className="h-3.5 w-3.5" /> Llamado a jugar · comunidad
          </p>
          <div className="flex items-center gap-3">
            <UserAvatar
              kind={call.user_profile?.avatar_kind}
              look={call.user_profile?.avatar_look}
              url={call.user_profile?.avatar_url}
              name={call.user_profile?.display_name ?? "Jugador"}
              className="h-11 w-11 shrink-0"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-sm font-bold text-foreground">
                {call.user_profile?.display_name ?? "Alguien"} busca jugar
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {fmtSlot(call.slots?.[0] ?? null)}
                {call.space?.name ? ` · ${call.space.name}` : ""}
              </p>
            </div>
            <Button
              size="sm"
              className="shrink-0 border border-info/40 bg-info text-white hover:bg-info/90"
              disabled={take.isPending}
              onClick={() => take.mutate(call.id)}
            >
              Tomar
            </Button>
          </div>
        </article>
      )}
    </section>
  );
}
