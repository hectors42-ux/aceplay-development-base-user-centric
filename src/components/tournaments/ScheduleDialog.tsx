import { useState } from "react";
import { AlertTriangle, ExternalLink, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Court, Match } from "@/hooks/useCategoryData";
import { useBookingsProvider, openExternalBooking } from "@/hooks/useBookingsProvider";
import { EXTERNAL_BOOKING_COPY } from "@/lib/external-bookings-copy";


interface ScheduleDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  match: Match | null;
  courts: Court[];
  onScheduled: () => void;
  mode?: "schedule" | "reschedule_admin";
}

export const ScheduleDialog = ({
  open,
  onOpenChange,
  match,
  courts,
  onScheduled,
  mode = "schedule",
}: ScheduleDialogProps) => {
  const [courtId, setCourtId] = useState<string>("");
  const [startsAt, setStartsAt] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const { isExternal, externalUrl } = useBookingsProvider();


  if (!match) return null;

  const handleSubmit = async () => {
    if (!courtId || !startsAt) {
      toast({ title: "Completa cancha y horario", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.rpc("schedule_match", {
      _match_id: match.id,
      _court_id: courtId,
      _starts_at: new Date(startsAt).toISOString(),
    });
    setSubmitting(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: mode === "reschedule_admin" ? "Partido reagendado" : "Partido programado",
      description: "Se bloqueó la cancha en el calendario.",
    });
    setCourtId("");
    setStartsAt("");
    onOpenChange(false);
    onScheduled();
  };

  const handleUnschedule = async () => {
    setSubmitting(true);
    const { error } = await supabase.rpc("unschedule_match", { _match_id: match.id });
    setSubmitting(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Programación cancelada" });
    onOpenChange(false);
    onScheduled();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "reschedule_admin" ? "Reagendar partido" : "Programar partido"}
          </DialogTitle>
          <DialogDescription>
            {isExternal
              ? EXTERNAL_BOOKING_COPY.tournamentDescription
              : "Se creará una reserva bloqueando la cancha en el calendario del club."}
          </DialogDescription>
        </DialogHeader>

        {isExternal && (
          <div
            role="note"
            className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-[12px] leading-snug text-amber-900 dark:text-amber-200"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="flex-1 space-y-2">
              <p>{EXTERNAL_BOOKING_COPY.tournamentReminder}</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => openExternalBooking(externalUrl)}
                className="h-7 gap-1 px-2 text-[11px]"
              >
                <ExternalLink className="h-3 w-3" />
                {EXTERNAL_BOOKING_COPY.cta}
              </Button>
            </div>
          </div>
        )}


        <div className="space-y-3 py-2">
          <div>
            <Label>Cancha</Label>
            <Select value={courtId} onValueChange={setCourtId}>
              <SelectTrigger>
                <SelectValue placeholder="Elige una cancha" />
              </SelectTrigger>
              <SelectContent>
                {courts.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="schedule-at">Inicio</Label>
            <Input
              id="schedule-at"
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          {match.scheduled_at && (
            <Button variant="ghost" onClick={handleUnschedule} disabled={submitting}>
              Quitar programación
            </Button>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {match.scheduled_at ? "Actualizar" : "Programar"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
