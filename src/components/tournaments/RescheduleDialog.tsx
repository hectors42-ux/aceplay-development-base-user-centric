import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Loader2, CalendarClock, MapPin, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Court, Match } from "@/hooks/useCategoryData";
import { useBookingsProvider } from "@/hooks/useBookingsProvider";
import { EXTERNAL_BOOKING_COPY } from "@/lib/external-bookings-copy";

interface RescheduleSlot {
  court_id: string;
  court_name: string;
  starts_at: string;
  ends_at: string;
}

interface RescheduleDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  match: Match | null;
  courts: Court[];
  windowHours: number;
  minNoticeHours: number;
  onRequested: () => void;
}

export const RescheduleDialog = ({
  open,
  onOpenChange,
  match,
  windowHours,
  minNoticeHours,
  onRequested,
}: RescheduleDialogProps) => {
  const [slots, setSlots] = useState<RescheduleSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selected, setSelected] = useState<RescheduleSlot | null>(null);
  const { isExternal } = useBookingsProvider();

  useEffect(() => {
    if (!open || !match) {
      setSlots([]);
      setSelected(null);
      return;
    }
    let cancel = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc("get_tournament_reschedule_slots", {
        _match_id: match.id,
      });
      if (cancel) return;
      setLoading(false);
      if (error) {
        toast({ title: "No se pudieron cargar huecos", description: error.message, variant: "destructive" });
        return;
      }
      setSlots((data ?? []) as RescheduleSlot[]);
    })();
    return () => {
      cancel = true;
    };
  }, [open, match]);

  // Agrupar slots por día
  const grouped = useMemo(() => {
    const map = new Map<string, RescheduleSlot[]>();
    for (const s of slots) {
      const key = format(parseISO(s.starts_at), "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return Array.from(map.entries()).map(([day, list]) => ({
      day,
      label: format(parseISO(list[0].starts_at), "EEEE d 'de' MMMM", { locale: es }),
      slots: list.sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
    }));
  }, [slots]);

  if (!match) return null;

  const handleSubmit = async () => {
    if (!selected) {
      toast({ title: "Elige un horario", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.rpc("request_match_reschedule", {
      _match_id: match.id,
      _proposed_court_id: selected.court_id,
      _proposed_starts_at: selected.starts_at,
    });
    setSubmitting(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: "Propuesta enviada",
      description: "Tu rival debe aceptarla para mover el partido.",
    });
    setSelected(null);
    onOpenChange(false);
    onRequested();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Proponer nuevo horario</DialogTitle>
          <DialogDescription>
            Elige uno de los huecos disponibles dentro de las canchas dedicadas al torneo y la
            ventana de la fase. Tu rival debe aceptar la propuesta. Solo puedes hacer{" "}
            <strong>un cambio aceptado por partido</strong>. Ventana ±{windowHours}h · mínimo {minNoticeHours}h
            de anticipación.
          </DialogDescription>
        </DialogHeader>

        {isExternal && (
          <div
            role="note"
            className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-[12px] leading-snug text-amber-900 dark:text-amber-200"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{EXTERNAL_BOOKING_COPY.tournamentReminder}</p>
          </div>
        )}


        <ScrollArea className="max-h-[55vh] pr-2">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : grouped.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
              No hay huecos válidos disponibles. Habla con el admin para revisar canchas o fases del
              torneo.
            </p>
          ) : (
            <div className="space-y-4 py-1">
              {grouped.map((group) => (
                <div key={group.day}>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {group.label}
                  </p>
                  <div className="grid gap-1.5">
                    {group.slots.map((s) => {
                      const isSel =
                        selected?.starts_at === s.starts_at && selected?.court_id === s.court_id;
                      return (
                        <button
                          type="button"
                          key={`${s.court_id}-${s.starts_at}`}
                          onClick={() => setSelected(s)}
                          className={cn(
                            "flex items-center justify-between rounded-2xl border px-3 py-2 text-left text-sm transition-smooth",
                            isSel
                              ? "border-primary bg-primary/10 ring-1 ring-primary"
                              : "border-border bg-card hover:bg-muted/40",
                          )}
                        >
                          <span className="flex items-center gap-2">
                            <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
                            {format(parseISO(s.starts_at), "HH:mm")}
                          </span>
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            {s.court_name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !selected}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enviar propuesta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
