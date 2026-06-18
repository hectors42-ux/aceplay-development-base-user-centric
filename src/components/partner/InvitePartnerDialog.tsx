import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface PartnerLite {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
}

interface Props {
  open: boolean;
  partner: PartnerLite | null;
  onClose: () => void;
  onSuccess?: (info: { partner: PartnerLite; compatScore?: number | null }) => void;
}

const initials = (a?: string | null, b?: string | null) =>
  `${a?.[0] ?? ""}${b?.[0] ?? ""}`.toUpperCase() || "?";

const TIMES = ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "19:00", "20:00", "21:00"];

const buildDayOptions = () => {
  const days: { iso: string; label: string; dayLabel: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    d.setHours(0, 0, 0, 0);
    days.push({
      iso: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString("es-CL", { weekday: "short", day: "numeric" }),
      dayLabel: d.toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "short" }),
    });
  }
  return days;
};

export const InvitePartnerDialog = ({ open, partner, onClose, onSuccess }: Props) => {
  const [message, setMessage] = useState("");
  const [slots, setSlots] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const days = useMemo(buildDayOptions, []);

  const reset = () => {
    setMessage("");
    setSlots([]);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const toggleSlot = (date: string, time: string) => {
    const iso = new Date(`${date}T${time}:00`).toISOString();
    setSlots((s) => {
      if (s.includes(iso)) return s.filter((x) => x !== iso);
      if (s.length >= 3) {
        toast({ title: "Máximo 3 horarios" });
        return s;
      }
      return [...s, iso];
    });
  };

  const submit = async () => {
    if (!partner) return;
    if (slots.length < 1) {
      toast({ title: "Propón al menos 1 horario", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.rpc("create_match_invitation", {
      _invitee_user_id: partner.user_id,
      _slots: slots.map((iso) => ({ starts_at: iso })),
      _message: message || null,
    });
    setSubmitting(false);
    if (error) {
      toast({ title: "No se pudo enviar", description: error.message, variant: "destructive" });
      return;
    }
    onSuccess?.({ partner });
    reset();
    onClose();
  };

  return (
    <Dialog open={open && !!partner} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto rounded-2xl">
        <DialogHeader className="text-left">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarImage src={partner?.avatar_url ?? undefined} />
              <AvatarFallback>{initials(partner?.first_name, partner?.last_name)}</AvatarFallback>
            </Avatar>
            <div>
              <DialogTitle className="font-display text-base">
                Invitar a {partner?.first_name}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Propón hasta 3 horarios. {partner?.first_name} elegirá uno y luego cada uno reserva su cancha.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Horarios propuestos ({slots.length}/3)
            </p>
            <div className="space-y-3">
              {days.map((d) => (
                <div key={d.iso}>
                  <p className="mb-1.5 text-[11px] font-semibold capitalize text-foreground">
                    {d.dayLabel}
                  </p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {TIMES.map((t) => {
                      const iso = new Date(`${d.iso}T${t}:00`).toISOString();
                      const active = slots.includes(iso);
                      const past = new Date(iso).getTime() < Date.now() + 60 * 60 * 1000;
                      return (
                        <button
                          key={t}
                          type="button"
                          disabled={past}
                          onClick={() => toggleSlot(d.iso, t)}
                          className={cn(
                            "rounded-lg border px-1 py-1.5 text-xs font-medium transition-smooth",
                            past && "opacity-25 cursor-not-allowed",
                            active
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-background hover:bg-muted",
                          )}
                        >
                          {t}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Mensaje (opcional)
            </p>
            <Textarea
              placeholder="Hola! ¿jugamos esta semana?"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={2}
              maxLength={200}
            />
          </div>
        </div>

        <div className="sticky bottom-0 -mx-6 -mb-6 mt-4 flex items-center justify-between gap-2 border-t border-border bg-background px-6 py-4">
          <Button variant="ghost" size="sm" onClick={handleClose}>
            Cancelar
          </Button>
          <Button variant="clay" onClick={submit} disabled={submitting || slots.length === 0}>
            {submitting ? "Enviando…" : `Enviar invitación · ${slots.length}/3`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
