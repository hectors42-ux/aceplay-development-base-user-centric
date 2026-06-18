import { useEffect, useState } from "react";
import { Loader2, CalendarRange, MapPin, Plus, Trash2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

const formatDateEsCL = (iso: string) => {
  if (!iso) return "";
  try {
    return format(parseISO(iso), "EEE d 'de' MMMM yyyy", { locale: es });
  } catch {
    return "";
  }
};

type Court = Tables<"courts">;
type Phase = Tables<"tournament_phases">;

interface TournamentCalendarPanelProps {
  tournamentId: string;
  tenantId: string;
}

/**
 * Panel admin para definir las canchas dedicadas y las fases del torneo.
 * Las fases definen la ventana de fechas y horario diario válido para
 * programar/reagendar partidos de cada ronda.
 */
export const TournamentCalendarPanel = ({
  tournamentId,
  tenantId,
}: TournamentCalendarPanelProps) => {
  const { profile } = useAuth();
  const [courts, setCourts] = useState<Court[]>([]);
  const [dedicated, setDedicated] = useState<Set<string>>(new Set());
  const [phases, setPhases] = useState<Phase[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingCourts, setSavingCourts] = useState(false);

  const load = async () => {
    if (!tenantId) return;
    setLoading(true);
    const [courtsRes, dedRes, phRes] = await Promise.all([
      supabase
        .from("courts")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .order("sort_order"),
      supabase.from("tournament_courts").select("court_id").eq("tournament_id", tournamentId),
      supabase
        .from("tournament_phases")
        .select("*")
        .eq("tournament_id", tournamentId)
        .order("round"),
    ]);
    setCourts(courtsRes.data ?? []);
    setDedicated(new Set((dedRes.data ?? []).map((d) => d.court_id)));
    setPhases(phRes.data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId, tenantId]);

  const toggleCourt = async (courtId: string) => {
    if (!profile) return;
    setSavingCourts(true);
    const next = new Set(dedicated);
    if (next.has(courtId)) {
      next.delete(courtId);
      const { error } = await supabase
        .from("tournament_courts")
        .delete()
        .eq("tournament_id", tournamentId)
        .eq("court_id", courtId);
      setSavingCourts(false);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        return;
      }
    } else {
      next.add(courtId);
      const { error } = await supabase.from("tournament_courts").insert({
        tournament_id: tournamentId,
        court_id: courtId,
        tenant_id: profile.tenant_id,
      });
      setSavingCourts(false);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        return;
      }
    }
    setDedicated(next);
    toast({ title: "Canchas actualizadas" });
  };

  const addPhase = async () => {
    if (!profile) return;
    const round = (phases[phases.length - 1]?.round ?? 0) + 1;
    const today = new Date().toISOString().slice(0, 10);
    const { error } = await supabase.from("tournament_phases").insert({
      tournament_id: tournamentId,
      tenant_id: profile.tenant_id,
      round,
      name: `Ronda ${round}`,
      starts_on: today,
      ends_on: today,
      daily_window_start: "08:00:00",
      daily_window_end: "22:00:00",
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    load();
  };

  const updatePhase = async (id: string, patch: Partial<Phase>) => {
    const { error } = await supabase.from("tournament_phases").update(patch).eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    setPhases((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const deletePhase = async (id: string) => {
    if (!confirm("¿Eliminar esta fase?")) return;
    const { error } = await supabase.from("tournament_phases").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    load();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Canchas dedicadas */}
      <section>
        <div className="mb-2 flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary" />
          <h3 className="font-display text-sm font-semibold">Canchas dedicadas al torneo</h3>
        </div>
        <p className="mb-2 text-xs text-muted-foreground">
          Solo estas canchas se usarán para programar/reagendar partidos del torneo.
        </p>
        <div className="flex flex-wrap gap-2">
          {courts.map((c) => {
            const sel = dedicated.has(c.id);
            return (
              <button
                key={c.id}
                type="button"
                disabled={savingCourts}
                onClick={() => toggleCourt(c.id)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition-smooth",
                  sel
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:bg-muted/50",
                )}
              >
                {c.name}
                {sel && <span className="ml-1.5 opacity-70">✓</span>}
              </button>
            );
          })}
        </div>
      </section>

      {/* Fases */}
      <section>
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CalendarRange className="h-4 w-4 text-primary" />
            <h3 className="font-display text-sm font-semibold">Fases del torneo</h3>
          </div>
          <Button size="sm" variant="outline" onClick={addPhase}>
            <Plus className="mr-1 h-3 w-3" /> Nueva fase
          </Button>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          Una fila por ronda. Las fechas y franja horaria definen la ventana válida para programar y
          reagendar partidos de esa ronda.
        </p>
        {phases.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-card/50 p-6 text-center text-sm text-muted-foreground">
            Aún no hay fases. Crea una por cada ronda del torneo (Primera, Octavos, Cuartos, Semi,
            Final).
          </p>
        ) : (
          <div className="space-y-2">
            {phases.map((p) => (
              <div
                key={p.id}
                className="space-y-2 rounded-2xl border border-border bg-card p-3"
              >
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="shrink-0">
                    R{p.round}
                  </Badge>
                  <Input
                    value={p.name}
                    onChange={(e) =>
                      setPhases((prev) =>
                        prev.map((x) => (x.id === p.id ? { ...x, name: e.target.value } : x)),
                      )
                    }
                    onBlur={(e) => updatePhase(p.id, { name: e.target.value })}
                    className="h-8 flex-1 text-sm"
                  />
                  <Button size="icon" variant="ghost" onClick={() => deletePhase(p.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Desde
                    </Label>
                    <Input
                      type="date"
                      value={p.starts_on}
                      onChange={(e) => {
                        const next = e.target.value;
                        // Auto-ajustar 'hasta' si queda inválido
                        const patch: Partial<Phase> = { starts_on: next };
                        if (next && p.ends_on && next > p.ends_on) {
                          patch.ends_on = next;
                        }
                        updatePhase(p.id, patch);
                      }}
                      className="h-8 text-xs"
                    />
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {formatDateEsCL(p.starts_on)}
                    </p>
                  </div>
                  <div>
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Hasta
                    </Label>
                    <Input
                      type="date"
                      min={p.starts_on || undefined}
                      value={p.ends_on}
                      onChange={(e) => updatePhase(p.id, { ends_on: e.target.value })}
                      className="h-8 text-xs"
                    />
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {formatDateEsCL(p.ends_on)}
                    </p>
                  </div>
                  <div>
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Franja desde
                    </Label>
                    <Input
                      type="time"
                      value={p.daily_window_start.slice(0, 5)}
                      onChange={(e) =>
                        updatePhase(p.id, { daily_window_start: `${e.target.value}:00` })
                      }
                      className="h-8 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Franja hasta
                    </Label>
                    <Input
                      type="time"
                      value={p.daily_window_end.slice(0, 5)}
                      onChange={(e) =>
                        updatePhase(p.id, { daily_window_end: `${e.target.value}:00` })
                      }
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
