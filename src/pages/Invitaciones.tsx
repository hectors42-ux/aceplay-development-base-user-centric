import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, Check, X, CalendarClock } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/avatar/UserAvatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useReceivedChallenges, useSentChallenges, useRespondChallenge } from "@/hooks/useCancha";
import { formatSlot, buildSlotPresets } from "@/lib/cancha-utils";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  pending: { label: "Pendiente", cls: "text-action border-action/30 bg-action/10" },
  accepted: { label: "Aceptado", cls: "text-verde border-verde/30 bg-verde/10" },
  rejected: { label: "Rechazado", cls: "text-muted-foreground border-border bg-muted" },
  rescheduled: { label: "Propuso otra", cls: "text-info border-info/30 bg-info/10" },
};

const Invitaciones = () => {
  const { data: received = [] } = useReceivedChallenges();
  const { data: sent = [] } = useSentChallenges();
  const respond = useRespondChallenge();
  const [proposeFor, setProposeFor] = useState<string | null>(null);
  const [proposeSlots, setProposeSlots] = useState<string[]>([]);
  const presets = buildSlotPresets();

  const submitPropose = () => {
    if (!proposeFor || proposeSlots.length === 0) return;
    respond.mutate(
      { id: proposeFor, action: "propose", slots: proposeSlots },
      { onSuccess: () => { setProposeFor(null); setProposeSlots([]); } },
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="safe-top sticky top-0 z-30 bg-background/80 px-5 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center gap-2">
          <Link to="/cancha" aria-label="Volver" className="grid h-9 w-9 place-items-center rounded-full hover:bg-muted">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h1 className="font-display text-lg font-bold tracking-tight text-foreground">Invitaciones</h1>
        </div>
      </header>

      <main className="mx-auto max-w-md px-5 pb-28 pt-2">
        <Tabs defaultValue="recibidas">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="recibidas">Recibidas {received.length > 0 && `(${received.length})`}</TabsTrigger>
            <TabsTrigger value="enviadas">Enviadas</TabsTrigger>
          </TabsList>

          {/* RECIBIDAS */}
          <TabsContent value="recibidas" className="mt-4 space-y-3">
            {received.length === 0 && (
              <p className="rounded-2xl border border-border bg-card/60 px-4 py-8 text-center text-sm text-muted-foreground">
                No tienes retos por responder.
              </p>
            )}
            {received.map((c) => (
              <article key={c.id} className="rounded-2xl border border-action/30 bg-card p-4 shadow-card">
                <div className="flex items-center gap-3">
                  <UserAvatar kind={c.from_profile?.avatar_kind} look={c.from_profile?.avatar_look} url={c.from_profile?.avatar_url} name={c.from_profile?.display_name ?? "Rival"} className="h-11 w-11 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-sm font-bold text-foreground">{c.from_profile?.display_name ?? "Un rival"} te retó</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {formatSlot(c.proposed_slots?.[0] ?? null)}{c.space?.name ? ` · ${c.space.name}` : ""}
                    </p>
                    {c.note && <p className="truncate text-xs italic text-muted-foreground">"{c.note}"</p>}
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <Button variant="clay" size="sm" className="flex-1 gap-1" disabled={respond.isPending}
                    onClick={() => respond.mutate({ id: c.id, action: "accept" })}>
                    Aceptar <Check className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1 gap-1" onClick={() => { setProposeFor(c.id); setProposeSlots([]); }}>
                    <CalendarClock className="h-4 w-4" /> Proponer otra
                  </Button>
                  <Button variant="ghost" size="icon" aria-label="Rechazar" disabled={respond.isPending}
                    onClick={() => respond.mutate({ id: c.id, action: "reject" })}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </article>
            ))}
          </TabsContent>

          {/* ENVIADAS */}
          <TabsContent value="enviadas" className="mt-4 space-y-3">
            {sent.length === 0 && (
              <p className="rounded-2xl border border-border bg-card/60 px-4 py-8 text-center text-sm text-muted-foreground">
                No has enviado retos todavía.
              </p>
            )}
            {sent.map((c) => {
              const st = STATUS_LABEL[c.status] ?? STATUS_LABEL.pending;
              return (
                <article key={c.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-card">
                  <UserAvatar kind={c.to_profile?.avatar_kind} look={c.to_profile?.avatar_look} url={c.to_profile?.avatar_url} name={c.to_profile?.display_name ?? "Rival"} className="h-11 w-11 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-sm font-bold text-foreground">{c.to_profile?.display_name ?? "Rival"}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {formatSlot(c.agreed_slot ?? c.proposed_slots?.[0] ?? null)}{c.space?.name ? ` · ${c.space.name}` : ""}
                    </p>
                  </div>
                  <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase", st.cls)}>{st.label}</span>
                </article>
              );
            })}
          </TabsContent>
        </Tabs>
      </main>

      {/* Dialog "Proponer otra" */}
      <Dialog open={!!proposeFor} onOpenChange={(v) => !v && setProposeFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Proponer otro día/hora</DialogTitle>
          </DialogHeader>
          <div className="flex flex-wrap gap-2">
            {presets.map((s) => (
              <button key={s.iso} type="button"
                onClick={() => setProposeSlots((p) => (p.includes(s.iso) ? p.filter((x) => x !== s.iso) : [...p, s.iso]))}
                className={cn("rounded-full border px-3 py-1.5 text-xs font-semibold capitalize transition-smooth",
                  proposeSlots.includes(s.iso) ? "border-action bg-action text-action-foreground" : "border-border bg-card text-muted-foreground")}>
                {proposeSlots.includes(s.iso) ? "✓ " : ""}{s.label}
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProposeFor(null)}>Cancelar</Button>
            <Button variant="clay" disabled={proposeSlots.length === 0 || respond.isPending} onClick={submitPropose}>
              Proponer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
};

export default Invitaciones;
