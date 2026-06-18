import { Check, Clock, Send, X as XIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { InviteRowState } from "@/hooks/useInviteRowStates";

interface Props {
  firstName: string | null;
  state?: InviteRowState;
  onInvite: () => void;
}

const fmtSlot = (iso?: string) => {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat("es-CL", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return null;
  }
};

const fmtDate = (iso?: string) => {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat("es-CL", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return null;
  }
};

/**
 * Botón/pill de acción de invitación para una fila del Ranking.
 * Refleja el estado de la última invitación enviada al jugador.
 */
export const InviteRowAction = ({ firstName, state, onInvite }: Props) => {
  // Sin estado o estado terminal "expired" → permite invitar (reintentar).
  if (!state || state.kind === "expired") {
    const label = state?.kind === "expired"
      ? `Invitación expirada con ${firstName}. Volver a invitar.`
      : `Invitar a jugar a ${firstName}`;
    const ariaTitle = state?.kind === "expired" ? "Invitación expirada · reintentar" : "Invitar a jugar";

    if (state?.kind === "expired") {
      // Pill expirado: misma forma que pending pero clickable para reintentar.
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onInvite();
              }}
              aria-label={label}
              className="ml-1 flex h-7 shrink-0 items-center justify-center gap-1 rounded-full border border-muted bg-muted px-2 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground transition-smooth hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
            >
              <Clock className="h-3 w-3" />
              Expirada
            </button>
          </TooltipTrigger>
          <TooltipContent side="left" className="max-w-[220px] text-xs">
            <p className="font-semibold">Invitación expirada</p>
            <p className="text-[11px] text-muted-foreground">
              La invitación venció sin respuesta. Toca para volver a invitar.
            </p>
          </TooltipContent>
        </Tooltip>
      );
    }

    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onInvite();
        }}
        aria-label={label}
        title={ariaTitle}
        className="ml-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary transition-smooth hover:bg-primary hover:text-primary-foreground"
      >
        <Send className="h-3.5 w-3.5" />
      </button>
    );
  }

  if (state.kind === "pending") {
    const nextSlot = fmtSlot(state.nextSlotISO);
    const expires = fmtDate(state.expiresAt);
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          {/* span wrapper para que el tooltip funcione sobre botón disabled */}
          <span tabIndex={0} className="ml-1 inline-flex shrink-0 focus:outline-none">
            <button
              type="button"
              disabled
              aria-label={`Invitación pendiente con ${firstName}`}
              className="flex h-7 cursor-not-allowed items-center justify-center gap-1 rounded-full border border-muted bg-muted px-2 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground"
            >
              <Clock className="h-3 w-3" />
              Pendiente
            </button>
          </span>
        </TooltipTrigger>
        <TooltipContent side="left" className="max-w-[240px] text-xs">
          <p className="font-semibold">Invitación pendiente</p>
          {nextSlot && (
            <p className="text-[11px] text-muted-foreground">
              Próximo horario propuesto: <span className="capitalize">{nextSlot}</span>
            </p>
          )}
          {expires && (
            <p className="text-[11px] text-muted-foreground">Vence el {expires}</p>
          )}
        </TooltipContent>
      </Tooltip>
    );
  }

  if (state.kind === "accepted") {
    const slot = fmtSlot(state.selectedSlotISO);
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0} className="ml-1 inline-flex shrink-0 focus:outline-none">
            <button
              type="button"
              disabled
              aria-label={`${firstName} aceptó tu invitación`}
              className={cn(
                "flex h-7 items-center justify-center gap-1 rounded-full border px-2 text-[9px] font-semibold uppercase tracking-wide",
                "border-success/30 bg-success/10 text-success cursor-default",
              )}
            >
              <Check className="h-3 w-3" />
              Aceptada
            </button>
          </span>
        </TooltipTrigger>
        <TooltipContent side="left" className="max-w-[240px] text-xs">
          <p className="font-semibold">Aceptó tu invitación</p>
          {slot && (
            <p className="text-[11px] text-muted-foreground capitalize">{slot}</p>
          )}
          <p className="text-[11px] text-muted-foreground">
            Coordina los detalles desde Buscar → Invitaciones.
          </p>
        </TooltipContent>
      </Tooltip>
    );
  }

  // rejected → reintentar disponible al click
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onInvite();
          }}
          aria-label={`${firstName} rechazó tu invitación. Volver a invitar.`}
          className="ml-1 flex h-7 shrink-0 items-center justify-center gap-1 rounded-full border border-muted bg-muted px-2 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground transition-smooth hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
        >
          <XIcon className="h-3 w-3" />
          Rechazada
        </button>
      </TooltipTrigger>
      <TooltipContent side="left" className="max-w-[220px] text-xs">
        <p className="font-semibold">Rechazó tu invitación</p>
        <p className="text-[11px] text-muted-foreground">Toca para volver a proponer otros horarios.</p>
      </TooltipContent>
    </Tooltip>
  );
};
