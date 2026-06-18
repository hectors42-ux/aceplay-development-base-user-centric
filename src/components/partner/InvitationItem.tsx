import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Check, X, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { memo, useState } from "react";
import { Link } from "react-router-dom";
import type { InvitationWithProfile } from "@/hooks/useMatchInvitations";
import { cn } from "@/lib/utils";
import { ExternalBookingCTA } from "@/components/booking/ExternalBookingCTA";

const initials = (a?: string | null, b?: string | null) =>
  `${a?.[0] ?? ""}${b?.[0] ?? ""}`.toUpperCase() || "?";

const formatSlot = (iso: string) =>
  new Date(iso).toLocaleString("es-CL", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendiente",
  accepted: "Aceptada",
  rejected: "Rechazada",
  expired: "Expirada",
  cancelled: "Cancelada",
};

const STATUS_COLOR: Record<string, string> = {
  pending: "border-warning/40 text-warning",
  accepted: "border-success/40 text-success",
  rejected: "border-destructive/40 text-destructive",
  expired: "border-muted text-muted-foreground",
  cancelled: "border-muted text-muted-foreground",
};

interface Props {
  invitation: InvitationWithProfile;
  side: "received" | "sent";
  onChanged: () => void;
}

const InvitationItemBase = ({ invitation, side, onChanged }: Props) => {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [pickedSlot, setPickedSlot] = useState<string | null>(null);

  const respond = async (accept: boolean) => {
    if (accept && !pickedSlot) {
      toast({ title: "Selecciona un horario", variant: "destructive" });
      return;
    }
    setBusy(true);
    const { error } = await supabase.rpc("respond_match_invitation", {
      _invitation_id: invitation.id,
      _selected_slot: accept ? { starts_at: pickedSlot } : {},
      _accept: accept,
    });
    setBusy(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: accept ? "Invitación aceptada" : "Invitación rechazada" });
    onChanged();
  };

  const cancel = async () => {
    setBusy(true);
    const { error } = await supabase
      .from("match_invitations")
      .update({ status: "cancelled" })
      .eq("id", invitation.id);
    setBusy(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Invitación cancelada" });
    onChanged();
  };

  const removeOld = async () => {
    if (!confirm("¿Eliminar esta invitación del historial?")) return;
    setBusy(true);
    const { error } = await supabase
      .from("match_invitations")
      .delete()
      .eq("id", invitation.id);
    setBusy(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Invitación eliminada" });
    onChanged();
  };

  const isOld = invitation.status !== "pending";

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <Avatar className="h-9 w-9">
          <AvatarImage src={invitation.counterpart?.avatar_url ?? undefined} />
          <AvatarFallback className="text-[11px]">
            {initials(invitation.counterpart?.first_name, invitation.counterpart?.last_name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            {invitation.counterpart?.first_name} {invitation.counterpart?.last_name}
          </p>
          {invitation.message && (
            <p className="mt-0.5 line-clamp-2 text-[10px] text-muted-foreground">
              "{invitation.message}"
            </p>
          )}
        </div>
        <Badge variant="outline" className={cn("h-4 rounded-md px-1.5 text-[9px] font-semibold", STATUS_COLOR[invitation.status])}>
          {STATUS_LABEL[invitation.status]}
        </Badge>
      </div>

      {invitation.status === "pending" && side === "received" && (
        <div className="mt-3 space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Elige un horario
          </p>
          {invitation.proposed_slots.map((s) => (
            <button
              key={s.starts_at}
              type="button"
              onClick={() => setPickedSlot(s.starts_at)}
              className={cn(
                "flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-xs transition-smooth",
                pickedSlot === s.starts_at
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-background hover:bg-muted",
              )}
            >
              <Clock className="h-3.5 w-3.5" />
              {formatSlot(s.starts_at)}
            </button>
          ))}
          <div className="flex gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => respond(false)} disabled={busy} className="flex-1">
              <X className="mr-1 h-3.5 w-3.5" /> Rechazar
            </Button>
            <Button variant="clay" size="sm" onClick={() => respond(true)} disabled={busy} className="flex-1">
              <Check className="mr-1 h-3.5 w-3.5" /> Aceptar
            </Button>
          </div>
        </div>
      )}

      {invitation.status === "pending" && side === "sent" && (
        <div className="mt-3">
          <div className="space-y-1">
            {invitation.proposed_slots.map((s) => (
              <div
                key={s.starts_at}
                className="flex items-center gap-2 text-[11px] text-muted-foreground"
              >
                <Clock className="h-3 w-3" /> {formatSlot(s.starts_at)}
              </div>
            ))}
          </div>
          <Button variant="ghost" size="sm" onClick={cancel} disabled={busy} className="mt-2 w-full">
            Cancelar invitación
          </Button>
        </div>
      )}

      {invitation.status === "accepted" && invitation.selected_slot?.starts_at && (
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-2 rounded-xl border border-success/30 bg-success/5 px-3 py-2 text-xs text-success">
            <Clock className="h-3.5 w-3.5" />
            <span>Confirmado: {formatSlot(invitation.selected_slot.starts_at)}</span>
          </div>
          <ExternalBookingCTA
            source="card"
            matchKind="partner_invitation"
            refId={invitation.id}
            fullWidth
            variant="outline"
          />
          <Button asChild variant="outline" size="sm" className="w-full">
            <Link to={`/partner/match/${invitation.id}`}>Ver detalle del partido</Link>
          </Button>
        </div>
      )}

      {isOld && (
        <div className="mt-3 flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={removeOld}
            disabled={busy}
            className="h-7 gap-1 text-[11px] text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" /> Eliminar del historial
          </Button>
        </div>
      )}
    </div>
  );
};

export const InvitationItem = memo(InvitationItemBase);

