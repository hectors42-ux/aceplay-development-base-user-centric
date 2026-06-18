import { Check, X, UserCheck, UserX, Loader2 } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import {
  Player,
  Registration,
  registrationLabel,
} from "@/hooks/useCategoryData";
import {
  REGISTRATION_STATUS_LABEL,
  registrationStatusColor,
} from "@/lib/tournament-utils";

interface RegistrationListProps {
  registrations: Registration[];
  players: Map<string, Player>;
  bracketGenerated: boolean;
  onChanged: () => void;
  isAdmin: boolean;
}

export const RegistrationList = ({
  registrations,
  players,
  bracketGenerated,
  onChanged,
  isAdmin,
}: RegistrationListProps) => {
  const { user } = useAuth();
  const [busyId, setBusyId] = useState<string | null>(null);

  if (registrations.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border bg-card/50 p-6 text-center text-sm text-muted-foreground">
        Sin inscripciones todavía.
      </p>
    );
  }

  const updateStatus = async (id: string, status: "confirmada" | "rechazada") => {
    setBusyId(id);
    const { error } = await supabase
      .from("tournament_registrations")
      .update({
        status,
        confirmed_at: status === "confirmada" ? new Date().toISOString() : null,
      })
      .eq("id", id);
    setBusyId(null);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: status === "confirmada" ? "Inscripción confirmada" : "Inscripción rechazada" });
    onChanged();
  };

  const acceptDoubles = async (id: string) => {
    setBusyId(id);
    const { error } = await supabase.rpc("accept_doubles_invitation", { _registration_id: id });
    setBusyId(null);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Aceptaste la invitación" });
    onChanged();
  };

  const rejectDoubles = async (id: string) => {
    setBusyId(id);
    const { error } = await supabase.rpc("reject_doubles_invitation", { _registration_id: id });
    setBusyId(null);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Invitación rechazada" });
    onChanged();
  };

  const withdraw = async (id: string) => {
    if (!confirm("¿Retirar esta inscripción?")) return;
    setBusyId(id);
    const { error } = await supabase.rpc("withdraw_from_category", { _registration_id: id });
    setBusyId(null);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Inscripción retirada" });
    onChanged();
  };

  const withdrawWithWalkover = async (id: string) => {
    if (
      !confirm(
        "El cuadro ya está generado. Esto da de baja al inscrito y entrega walkover a su rival en el próximo partido. ¿Continuar?",
      )
    )
      return;
    setBusyId(id);
    const { error } = await supabase.rpc("withdraw_registration_with_walkover", {
      _registration_id: id,
    });
    setBusyId(null);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Inscripción dada de baja", description: "Se aplicó walkover al rival." });
    onChanged();
  };

  return (
    <div className="space-y-2">
      {registrations.map((r) => {
        const isInvitedPartner = user && r.player2_user_id === user.id && r.status === "pendiente_pareja";
        const isOwn = user && (r.player1_user_id === user.id || r.player2_user_id === user.id);
        const busy = busyId === r.id;
        return (
          <div
            key={r.id}
            className="flex items-center justify-between gap-2 rounded-2xl border border-border bg-card px-4 py-3"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{registrationLabel(r, players)}</p>
              <span
                className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${registrationStatusColor(r.status)}`}
              >
                {REGISTRATION_STATUS_LABEL[r.status]}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {busy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              {isInvitedPartner && (
                <>
                  <Button size="icon" variant="ghost" title="Aceptar pareja" onClick={() => acceptDoubles(r.id)} disabled={busy}>
                    <UserCheck className="h-4 w-4 text-emerald-600" />
                  </Button>
                  <Button size="icon" variant="ghost" title="Rechazar" onClick={() => rejectDoubles(r.id)} disabled={busy}>
                    <UserX className="h-4 w-4 text-destructive" />
                  </Button>
                </>
              )}
              {isAdmin && r.status === "pendiente_admin" && (
                <>
                  <Button size="icon" variant="ghost" title="Confirmar" onClick={() => updateStatus(r.id, "confirmada")} disabled={busy}>
                    <Check className="h-4 w-4 text-emerald-600" />
                  </Button>
                  <Button size="icon" variant="ghost" title="Rechazar" onClick={() => updateStatus(r.id, "rechazada")} disabled={busy}>
                    <X className="h-4 w-4 text-destructive" />
                  </Button>
                </>
              )}
              {(isAdmin || isOwn) &&
                !bracketGenerated &&
                (r.status === "confirmada" || r.status === "pendiente_admin") && (
                  <Button size="sm" variant="ghost" onClick={() => withdraw(r.id)} disabled={busy}>
                    Retirar
                  </Button>
                )}
              {isAdmin &&
                bracketGenerated &&
                r.status === "confirmada" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => withdrawWithWalkover(r.id)}
                    disabled={busy}
                  >
                    Dar de baja
                  </Button>
                )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
