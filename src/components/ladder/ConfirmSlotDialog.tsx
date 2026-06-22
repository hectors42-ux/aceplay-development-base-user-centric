import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { AlertTriangle, CalendarClock, Check, ExternalLink, Loader2, MapPin, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useBookingsProvider, openExternalBooking } from "@/hooks/useBookingsProvider";
import { EXTERNAL_BOOKING_COPY } from "@/lib/external-bookings-copy";
import { PartnerPicker } from "@/components/PartnerPicker";


interface SlotOption {
  index: 1 | 2 | 3;
  court_id: string;
  court_name: string;
  starts_at: Date;
}

interface ConfirmSlotDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  challengeId: string;
  onConfirmed?: () => void;
}

interface ProposalRow {
  id: string;
  slot1_court_id: string;
  slot1_starts_at: string;
  slot2_court_id: string | null;
  slot2_starts_at: string | null;
  slot3_court_id: string | null;
  slot3_starts_at: string | null;
}

const bandOf = (d: Date) => {
  const h = d.getHours();
  if (h < 12) return "Mañana";
  if (h < 18) return "Tarde";
  return "Noche";
};

export const ConfirmSlotDialog = ({
  open,
  onOpenChange,
  challengeId,
  onConfirmed,
}: ConfirmSlotDialogProps) => {
  const [proposal, setProposal] = useState<ProposalRow | null>(null);
  const [options, setOptions] = useState<SlotOption[]>([]);
  const [selected, setSelected] = useState<1 | 2 | 3 | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isPadelDoubles, setIsPadelDoubles] = useState(false);
  const [challengerId, setChallengerId] = useState<string | null>(null);
  const [challengerPartnerId, setChallengerPartnerId] = useState<string | null>(null);
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const { isExternal, externalUrl } = useBookingsProvider();


  useEffect(() => {
    if (!open) {
      setSelected(null);
      setProposal(null);
      setOptions([]);
      setPartnerId(null);
      setIsPadelDoubles(false);
      setChallengerId(null);
      setChallengerPartnerId(null);
      return;
    }
    void (async () => {
      setLoading(true);
      // Cargar el desafío + disciplina del ladder
      const { data: ch } = await supabase
        .from("ladder_challenges")
        .select("ladder_id, challenger_user_id, challenger_partner_user_id, ladders(discipline)")
        .eq("id", challengeId)
        .maybeSingle();
      const discipline =
        (ch as { ladders?: { discipline?: string } | null } | null)?.ladders?.discipline ?? null;
      setIsPadelDoubles(discipline === "padel_dobles");
      setChallengerId((ch as { challenger_user_id?: string } | null)?.challenger_user_id ?? null);
      setChallengerPartnerId(
        (ch as { challenger_partner_user_id?: string | null } | null)?.challenger_partner_user_id ??
          null,
      );

      const { data: prop } = await supabase
        .from("ladder_challenge_schedule_proposals")
        .select("*")
        .eq("challenge_id", challengeId)
        .eq("status", "pendiente")
        .order("proposed_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!prop) {
        setLoading(false);
        toast({
          title: "Sin horarios propuestos",
          description: "Tu rival aún no propone horarios.",
        });
        onOpenChange(false);
        return;
      }

      const courtIds = [prop.slot1_court_id, prop.slot2_court_id, prop.slot3_court_id].filter(
        (id): id is string => !!id,
      );
      const { data: courts } = await supabase
        .from("courts")
        .select("id, name")
        .in("id", courtIds);
      const nameById = Object.fromEntries((courts ?? []).map((c) => [c.id, c.name]));

      const opts: SlotOption[] = [];
      const push = (
        idx: 1 | 2 | 3,
        court_id: string | null,
        starts_at: string | null,
      ) => {
        if (!court_id || !starts_at) return;
        opts.push({
          index: idx,
          court_id,
          court_name: nameById[court_id] ?? "Cancha",
          starts_at: parseISO(starts_at),
        });
      };
      push(1, prop.slot1_court_id, prop.slot1_starts_at);
      push(2, prop.slot2_court_id, prop.slot2_starts_at);
      push(3, prop.slot3_court_id, prop.slot3_starts_at);

      opts.sort((a, b) => a.starts_at.getTime() - b.starts_at.getTime());

      setProposal(prop as ProposalRow);
      setOptions(opts);
      setLoading(false);
    })();
  }, [open, challengeId, onOpenChange]);

  // Días únicos para el chip horizontal estilo iOS
  const uniqueDays = useMemo(() => {
    const map = new Map<string, Date>();
    for (const o of options) {
      const k = format(o.starts_at, "yyyy-MM-dd");
      if (!map.has(k)) map.set(k, o.starts_at);
    }
    return Array.from(map.values()).sort((a, b) => a.getTime() - b.getTime());
  }, [options]);

  const [activeDayKey, setActiveDayKey] = useState<string | null>(null);
  useEffect(() => {
    if (uniqueDays.length > 0 && !activeDayKey) {
      setActiveDayKey(format(uniqueDays[0], "yyyy-MM-dd"));
    }
  }, [uniqueDays, activeDayKey]);

  const visibleOptions = useMemo(() => {
    if (!activeDayKey) return options;
    return options.filter((o) => format(o.starts_at, "yyyy-MM-dd") === activeDayKey);
  }, [options, activeDayKey]);

  const handleConfirm = async () => {
    if (!proposal || !selected) return;
    if (isPadelDoubles && !partnerId) {
      toast({ title: "Elige un compañero", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.rpc("confirm_ladder_challenge_slot", {
      _proposal_id: proposal.id,
      _slot_index: selected,
      ...(isPadelDoubles ? { _challenged_partner_user_id: partnerId } : {}),
    } as never);
    setSubmitting(false);
    if (error) {
      toast({
        title: "No se pudo confirmar",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "¡Partido confirmado!",
      description: "La cancha quedó reservada.",
    });
    onOpenChange(false);
    onConfirmed?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-md flex-col overflow-hidden rounded-3xl p-0">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle className="flex items-center gap-2 font-display">
            <CalendarClock className="h-5 w-5 text-primary" />
            Elige un horario
          </DialogTitle>
          <DialogDescription>
            {isExternal
              ? EXTERNAL_BOOKING_COPY.ladderDescription
              : "Tu rival propuso 3 horarios. La cancha está pre-asignada y se reserva al confirmar."}
          </DialogDescription>
        </DialogHeader>


        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-4">
              {isExternal && (
                <div
                  role="note"
                  className="flex items-start gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-[12px] leading-snug text-amber-900 dark:text-amber-200"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>{EXTERNAL_BOOKING_COPY.banner}</p>
                </div>
              )}
              {/* Tira horizontal de días estilo iOS */}
              {uniqueDays.length > 1 && (

                <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-none snap-x snap-mandatory">
                  {uniqueDays.map((d) => {
                    const k = format(d, "yyyy-MM-dd");
                    const isActive = activeDayKey === k;
                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => {
                          setActiveDayKey(k);
                          setSelected(null);
                        }}
                        className={cn(
                          "flex w-16 shrink-0 snap-start flex-col items-center gap-0.5 rounded-2xl border px-2 py-2 text-center transition-smooth",
                          isActive
                            ? "border-primary bg-primary text-primary-foreground shadow-clay"
                            : "border-border bg-card hover:border-primary/40",
                        )}
                      >
                        <span className="text-[10px] uppercase tracking-wider opacity-80">
                          {format(d, "EEE", { locale: es })}
                        </span>
                        <span className="font-display text-lg font-semibold leading-none">
                          {format(d, "d")}
                        </span>
                        <span className="mt-0.5 text-[9px] opacity-80">
                          {format(d, "MMM", { locale: es })}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="space-y-2">
                {visibleOptions.map((opt) => {
                  const isSel = selected === opt.index;
                  return (
                    <button
                      key={opt.index}
                      type="button"
                      onClick={() => setSelected(opt.index)}
                      className={cn(
                        "w-full rounded-2xl border p-4 text-left transition-smooth",
                        isSel
                          ? "border-primary bg-primary/10 ring-1 ring-primary shadow-clay"
                          : "border-border bg-card hover:border-primary/40 hover:bg-primary/5",
                      )}
                      aria-pressed={isSel}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            {bandOf(opt.starts_at)}
                          </p>
                          <p className="font-display text-2xl font-semibold leading-none">
                            {format(opt.starts_at, "HH:mm")}
                            <span className="ml-1 text-xs font-normal text-muted-foreground">h</span>
                          </p>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {format(opt.starts_at, "EEEE d 'de' MMMM", { locale: es })}
                          </p>
                          <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            {opt.court_name}
                          </p>
                        </div>
                        <div
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border",
                            isSel
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-card text-muted-foreground",
                          )}
                        >
                          {isSel ? <Check className="h-4 w-4" /> : null}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {isPadelDoubles && (
                <div className="space-y-2 rounded-2xl border border-border bg-card p-3">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <Users className="h-3.5 w-3.5" /> Tu compañero de pareja
                  </p>
                  <PartnerPicker
                    value={partnerId}
                    onChange={(id) => setPartnerId(id)}
                    excludeUserId={challengerId}
                  />
                  {challengerPartnerId && partnerId === challengerPartnerId && (
                    <p className="text-[11px] text-destructive">
                      Ese jugador ya está en la pareja rival.
                    </p>
                  )}
                  <p className="text-[11px] text-muted-foreground">
                    Debe estar inscrito en esta Escalerilla y no ser parte del lado contrario.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 border-t border-border px-5 py-3 sm:flex-row">
          {isExternal && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => openExternalBooking(externalUrl)}
              className="gap-1.5 text-xs sm:mr-auto"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {EXTERNAL_BOOKING_COPY.cta}
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
            className="flex-1"
          >
            Cancelar
          </Button>
          <Button
            variant="clay"
            onClick={handleConfirm}
            disabled={
              submitting ||
              !selected ||
              (isPadelDoubles && (!partnerId || partnerId === challengerPartnerId))
            }
            className="flex-1"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : isExternal ? "Confirmar horario" : "Confirmar"}
          </Button>
        </DialogFooter>

      </DialogContent>
    </Dialog>
  );
};
