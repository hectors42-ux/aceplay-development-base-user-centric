import { useEffect, useMemo, useState } from "react";
import { Loader2, Lock, Plus, Trash2, Unlock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { HapticButton } from "@/components/feedback";
import { toast } from "@/hooks/use-toast";
import { useTournamentSessions, type TournamentSession } from "@/hooks/useTournamentSessions";
import { AddSessionDialog } from "./AddSessionDialog";
import { CourtBookingGrid } from "./CourtBookingGrid";

interface Props {
  tournamentId: string;
}

const formatRange = (s: TournamentSession) => {
  const f = new Date(s.starts_at);
  const t = new Date(s.ends_at);
  const date = f.toLocaleDateString("es-CL", { weekday: "short", day: "2-digit", month: "short" });
  const hh = (d: Date) =>
    d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${date} · ${hh(f)}–${hh(t)}`;
};

export const SessionsTab = ({ tournamentId }: Props) => {
  const { profile } = useAuth();
  const { sessions, loading, reload } = useTournamentSessions(tournamentId);
  const [active, setActive] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [draftCourts, setDraftCourts] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const current = useMemo(
    () => sessions.find((s) => s.id === active) ?? sessions[0] ?? null,
    [sessions, active],
  );

  useEffect(() => {
    if (current) {
      setDraftCourts(current.court_ids);
      if (!active) setActive(current.id);
    }
  }, [current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  const saveCourts = async () => {
    if (!current) return;
    setSaving(true);
    const { error } = await supabase
      .from("tournament_sessions" as never)
      .update({ court_ids: draftCourts } as never)
      .eq("id", current.id);
    setSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Canchas guardadas" });
    reload();
  };

  const handleBlock = async () => {
    if (!current) return;
    if (draftCourts.length === 0) {
      toast({ title: "Selecciona al menos una cancha", variant: "destructive" });
      return;
    }
    setSaving(true);
    // Guardar primero los court_ids actualizados
    const { error: upErr } = await supabase
      .from("tournament_sessions" as never)
      .update({ court_ids: draftCourts } as never)
      .eq("id", current.id);
    if (upErr) {
      setSaving(false);
      toast({ title: "Error", description: upErr.message, variant: "destructive" });
      return;
    }
    const { error } = await supabase.rpc("block_tournament_session" as never, {
      _session_id: current.id,
    } as never);
    setSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Canchas bloqueadas", description: "Se reservaron en el calendario del club." });
    reload();
  };

  const handleUnblock = async () => {
    if (!current) return;
    if (!confirm("¿Liberar las canchas? Los socios volverán a verlas disponibles.")) return;
    setSaving(true);
    const { error } = await supabase.rpc("unblock_tournament_session" as never, {
      _session_id: current.id,
    } as never);
    setSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Canchas liberadas" });
    reload();
  };

  const handleDelete = async () => {
    if (!current) return;
    if (!confirm(`¿Eliminar "${current.name}"? Se liberarán sus canchas.`)) return;
    const { error } = await supabase
      .from("tournament_sessions" as never)
      .delete()
      .eq("id", current.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Sesión eliminada" });
    setActive(null);
    reload();
  };

  const previousSession = sessions[sessions.length - 1] ?? null;
  const isBlocked = current?.status === "bloqueada";

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Sesiones del torneo
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Cada sesión bloquea canchas y aparece como toggle de disponibilidad al inscribirse.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
          <Plus className="mr-1 h-4 w-4" /> Agregar sesión
        </Button>
      </div>

      {sessions.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-card/50 p-6 text-center text-sm text-muted-foreground">
          Aún no hay sesiones. Agrega la primera para empezar a reservar canchas.
        </p>
      ) : (
        <Tabs value={current?.id ?? ""} onValueChange={setActive}>
          <TabsList className="flex w-full flex-wrap justify-start gap-1 overflow-x-auto">
            {sessions.map((s) => (
              <TabsTrigger key={s.id} value={s.id} className="text-xs">
                {s.name}
                {s.status === "bloqueada" && <Lock className="ml-1 h-3 w-3" />}
              </TabsTrigger>
            ))}
          </TabsList>
          {current && (
            <TabsContent value={current.id} className="mt-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-card px-4 py-3">
                <div>
                  <p className="text-sm font-semibold">{current.name}</p>
                  <p className="text-xs text-muted-foreground">{formatRange(current)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
                      isBlocked
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {current.status}
                  </span>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {current.court_ids.length} cancha(s)
                  </span>
                  <Button size="icon" variant="ghost" onClick={handleDelete} aria-label="Eliminar sesión">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {profile?.tenant_id && (
                <CourtBookingGrid
                  tenantId={profile.tenant_id}
                  sessionId={current.id}
                  startsAt={current.starts_at}
                  endsAt={current.ends_at}
                  selectedCourts={draftCourts}
                  onChange={setDraftCourts}
                  readOnly={isBlocked}
                />
              )}

              <div className="flex flex-wrap items-center justify-end gap-2">
                {!isBlocked && (
                  <Button variant="outline" size="sm" onClick={saveCourts} disabled={saving}>
                    Guardar selección
                  </Button>
                )}
                {isBlocked ? (
                  <HapticButton
                    level="medium"
                    onClick={handleUnblock}
                    disabled={saving}
                    className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlock className="h-4 w-4" />}
                    Desbloquear canchas
                  </HapticButton>
                ) : (
                  <HapticButton
                    level="heavy"
                    onClick={handleBlock}
                    disabled={saving || draftCourts.length === 0}
                    className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                    Confirmar reserva de canchas
                  </HapticButton>
                )}
              </div>
            </TabsContent>
          )}
        </Tabs>
      )}

      <AddSessionDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        tournamentId={tournamentId}
        previousSession={previousSession}
        onCreated={reload}
      />
    </section>
  );
};