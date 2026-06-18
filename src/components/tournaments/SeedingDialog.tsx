import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowDown, ArrowLeft, ArrowUp, CalendarClock, Loader2, Wand2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Player, Registration, registrationLabel } from "@/hooks/useCategoryData";

interface SeedingDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  categoryId: string;
  registrations: Registration[];
  players: Map<string, Player>;
  onGenerated: () => void;
  /** Motor de la categoría: define qué RPC se llama para generar la llave. */
  motor?: string | null;
}

interface PhaseSlot {
  court_id: string;
  court_name: string;
  starts_at: string;
  ends_at: string;
}

interface FirstRoundMatch {
  id: string;
  bracket_position: number;
  registration_a_id: string | null;
  registration_b_id: string | null;
  selected_slot?: string; // `${court_id}|${starts_at}`
}

type Step = "seeding" | "scheduling";

export const SeedingDialog = ({
  open,
  onOpenChange,
  categoryId,
  registrations,
  players,
  onGenerated,
  motor,
}: SeedingDialogProps) => {
  const confirmed = registrations.filter((r) => r.status === "confirmada");
  const [order, setOrder] = useState<string[]>(confirmed.map((r) => r.id));
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<Step>("seeding");
  const [matches, setMatches] = useState<FirstRoundMatch[]>([]);
  const [slots, setSlots] = useState<PhaseSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [tournamentId, setTournamentId] = useState<string | null>(null);

  const syncedKey = confirmed.map((r) => r.id).join(",");
  const orderKey = order.filter((id) => id).join(",");
  if (open && orderKey !== syncedKey && order.length === 0) {
    setOrder(confirmed.map((r) => r.id));
  }

  // reset on close
  useEffect(() => {
    if (!open) {
      setStep("seeding");
      setMatches([]);
      setSlots([]);
    }
  }, [open]);

  const move = (idx: number, dir: -1 | 1) => {
    const next = [...order];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setOrder(next);
  };

  const insertBye = (idx: number) => {
    const next = [...order];
    next.splice(idx + 1, 0, "");
    setOrder(next);
  };

  const removeBye = (idx: number) => {
    const next = [...order];
    if (next[idx] === "") next.splice(idx, 1);
    setOrder(next);
  };

  const autoSeed = () => {
    setOrder(confirmed.map((r) => r.id));
  };

  const handleGenerate = async () => {
    if (confirmed.length < 2) {
      toast({ title: "Necesitas al menos 2 inscripciones confirmadas", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const seedOrder = order.map((id) => (id === "" ? null : id));
    const rpcName =
      motor === "consolacion"
        ? "generate_consolation"
        : motor === "doble_eliminacion"
          ? "generate_double_elimination"
          : "generate_bracket";
    const { error } = await supabase.rpc(rpcName as never, {
      _category_id: categoryId,
      _seed_order: seedOrder as never,
    } as never);
    if (error) {
      setSubmitting(false);
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    // Cargar partidos de primera ronda + tournament_id + huecos
    const { data: cat } = await supabase
      .from("tournament_categories")
      .select("tournament_id")
      .eq("id", categoryId)
      .maybeSingle();
    const tId = cat?.tournament_id ?? null;
    setTournamentId(tId);

    const { data: ms } = await supabase
      .from("tournament_matches")
      .select("id, bracket_position, registration_a_id, registration_b_id, round")
      .eq("tournament_category_id", categoryId)
      .order("bracket_position");
    const maxRound = (ms ?? []).reduce((acc, m) => Math.max(acc, m.round), 0);
    const firstRound = (ms ?? [])
      .filter((m) => m.round === 1 && m.registration_a_id && m.registration_b_id)
      .map<FirstRoundMatch>((m) => ({
        id: m.id,
        bracket_position: m.bracket_position,
        registration_a_id: m.registration_a_id,
        registration_b_id: m.registration_b_id,
      }));
    setMatches(firstRound);

    if (firstRound.length === 0) {
      // Sin partidos jugables (todos BYE) → cerramos
      setSubmitting(false);
      toast({ title: "Llave generada", description: "No hay partidos en primera ronda." });
      onOpenChange(false);
      onGenerated();
      return;
    }

    setLoadingSlots(true);
    const { data: slotData, error: slotError } = await supabase.rpc(
      "get_tournament_phase_slots",
      { _tournament_id: tId, _round: 1 } as never,
    );
    setLoadingSlots(false);
    setSubmitting(false);

    if (slotError) {
      toast({
        title: "Llave generada (sin auto-asignación)",
        description: "No pudimos cargar horarios. Programa los partidos manualmente.",
        variant: "destructive",
      });
      onOpenChange(false);
      onGenerated();
      return;
    }

    const slotList = (slotData ?? []) as PhaseSlot[];
    setSlots(slotList);
    // Pre-asignar: greedy distinct slots
    const used = new Set<string>();
    setMatches((prev) =>
      prev.map((m) => {
        const slot = slotList.find((s) => !used.has(`${s.court_id}|${s.starts_at}`));
        if (slot) {
          const key = `${slot.court_id}|${slot.starts_at}`;
          used.add(key);
          return { ...m, selected_slot: key };
        }
        return m;
      }),
    );

    if (slotList.length === 0) {
      toast({
        title: "Llave generada",
        description: "Sin horarios disponibles en la fase. Configura fases del torneo.",
      });
    }

    setStep("scheduling");
  };

  const slotByKey = useMemo(() => {
    const map = new Map<string, PhaseSlot>();
    slots.forEach((s) => map.set(`${s.court_id}|${s.starts_at}`, s));
    return map;
  }, [slots]);

  const usedKeys = useMemo(() => {
    const set = new Set<string>();
    matches.forEach((m) => {
      if (m.selected_slot) set.add(m.selected_slot);
    });
    return set;
  }, [matches]);

  const setMatchSlot = (matchId: string, key: string | undefined) => {
    setMatches((prev) =>
      prev.map((m) => (m.id === matchId ? { ...m, selected_slot: key } : m)),
    );
  };

  const handleScheduleAll = async () => {
    setSubmitting(true);
    let okCount = 0;
    let errors: string[] = [];
    for (const m of matches) {
      if (!m.selected_slot) continue;
      const slot = slotByKey.get(m.selected_slot);
      if (!slot) continue;
      const { error } = await supabase.rpc("schedule_match", {
        _match_id: m.id,
        _starts_at: slot.starts_at,
        _court_id: slot.court_id,
      });
      if (error) {
        errors.push(`P${m.bracket_position}: ${error.message}`);
      } else {
        okCount++;
      }
    }
    setSubmitting(false);
    if (errors.length > 0) {
      toast({
        title: `${okCount} partidos programados, ${errors.length} con error`,
        description: errors.slice(0, 3).join(" · "),
        variant: "destructive",
      });
    } else {
      toast({
        title: `${okCount} partidos programados`,
        description: "Los jugadores deben aceptar el horario propuesto.",
      });
    }
    onOpenChange(false);
    onGenerated();
  };

  const handleSkipScheduling = () => {
    onOpenChange(false);
    onGenerated();
  };

  const labelOf = (regId: string | null) => {
    if (!regId) return "BYE";
    const reg = registrations.find((r) => r.id === regId);
    return registrationLabel(reg, players);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {step === "seeding" ? "Generar llave" : "Asignar canchas y horarios"}
          </DialogTitle>
          <DialogDescription>
            {step === "seeding"
              ? "Ordena las inscripciones confirmadas. Las posiciones 1-2, 3-4, 5-6… se enfrentan en primera ronda."
              : "Te proponemos un horario por partido dentro de la fase del torneo. Puedes cambiarlo o saltar este paso."}
          </DialogDescription>
        </DialogHeader>

        {step === "seeding" ? (
          <>
            <div className="flex items-center justify-between border-b border-border pb-2">
              <span className="text-xs text-muted-foreground">
                {order.filter((x) => x).length} inscritos · {order.filter((x) => !x).length} BYEs ·{" "}
                {order.length} posiciones
              </span>
              <Button variant="ghost" size="sm" onClick={autoSeed}>
                <Wand2 className="mr-1 h-3 w-3" /> Reset
              </Button>
            </div>

            <div className="max-h-[50vh] space-y-1.5 overflow-y-auto py-1">
              {order.map((regId, idx) => {
                const reg = regId ? registrations.find((r) => r.id === regId) : undefined;
                const isBye = !regId;
                return (
                  <div
                    key={`${regId}-${idx}`}
                    className={`flex items-center gap-2 rounded-2xl border px-3 py-2 ${
                      isBye ? "border-dashed border-border bg-muted/30" : "border-border bg-card"
                    }`}
                  >
                    <span className="w-6 text-xs font-mono text-muted-foreground">{idx + 1}</span>
                    <span className="flex-1 text-sm">
                      {isBye ? (
                        <em className="text-muted-foreground">BYE</em>
                      ) : (
                        registrationLabel(reg, players)
                      )}
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => move(idx, -1)}
                      disabled={idx === 0}
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => move(idx, 1)}
                      disabled={idx === order.length - 1}
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                    {isBye ? (
                      <Button size="sm" variant="ghost" onClick={() => removeBye(idx)}>
                        Quitar
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => insertBye(idx)}>
                        +BYE
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={handleGenerate} disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Generar llave
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-border pb-2">
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <CalendarClock className="h-3 w-3" />
                {matches.length} partidos · {slots.length} huecos disponibles
              </span>
            </div>

            {loadingSlots ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : slots.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-4 text-center text-xs text-muted-foreground">
                No hay horarios disponibles en la fase configurada. Puedes saltar este paso y
                programar los partidos manualmente desde la pestaña "Programar".
              </div>
            ) : (
              <div className="max-h-[50vh] space-y-2 overflow-y-auto py-1">
                {matches.map((m) => {
                  const a = labelOf(m.registration_a_id);
                  const b = labelOf(m.registration_b_id);
                  const availableSlots = slots.filter(
                    (s) =>
                      `${s.court_id}|${s.starts_at}` === m.selected_slot ||
                      !usedKeys.has(`${s.court_id}|${s.starts_at}`),
                  );
                  return (
                    <div
                      key={m.id}
                      className="rounded-2xl border border-border bg-card p-3 text-xs"
                    >
                      <p className="mb-1 font-semibold text-foreground">
                        P{m.bracket_position}: {a} <span className="text-muted-foreground">vs</span>{" "}
                        {b}
                      </p>
                      <Select
                        value={m.selected_slot ?? "__none__"}
                        onValueChange={(v) =>
                          setMatchSlot(m.id, v === "__none__" ? undefined : v)
                        }
                      >
                        <SelectTrigger className="h-9 text-xs">
                          <SelectValue placeholder="Sin horario" />
                        </SelectTrigger>
                        <SelectContent className="max-h-60 bg-popover">
                          <SelectItem value="__none__">Sin horario</SelectItem>
                          {availableSlots.map((s) => (
                            <SelectItem
                              key={`${s.court_id}|${s.starts_at}`}
                              value={`${s.court_id}|${s.starts_at}`}
                            >
                              {s.court_name} ·{" "}
                              {format(parseISO(s.starts_at), "EEE d MMM HH:mm", { locale: es })}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}
              </div>
            )}

            <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
              <Button
                variant="ghost"
                onClick={() => setStep("seeding")}
                disabled={submitting}
                className="sm:mr-auto"
              >
                <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Volver
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleSkipScheduling} disabled={submitting}>
                  Saltar
                </Button>
                <Button
                  onClick={handleScheduleAll}
                  disabled={submitting || matches.every((m) => !m.selected_slot)}
                >
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Programar partidos
                </Button>
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
