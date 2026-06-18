import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Plus, Trash2, CircleDollarSign, CalendarClock } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import { useCoaches } from "@/hooks/useCoaches";
import {
  useAdminClassBlocks,
  useUpsertClassBlock,
  useDeleteClassBlock,
  useCoachSettlements,
  useMarkAllPaid,
  type AdminClassBlock,
} from "@/hooks/useAdminCoachData";

const WEEKDAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

const AdminClases = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { data: blocks = [], isLoading: loadingBlocks } = useAdminClassBlocks();
  const { data: coaches = [] } = useCoaches();
  const { data: settlements = [], isLoading: loadingSettle } = useCoachSettlements();
  const upsert = useUpsertClassBlock();
  const remove = useDeleteClassBlock();
  const markPaid = useMarkAllPaid();
  const [editing, setEditing] = useState<Partial<AdminClassBlock> | null>(null);

  const { data: courts = [] } = useQuery({
    queryKey: ["admin-courts", profile?.tenant_id],
    enabled: !!profile?.tenant_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("courts")
        .select("id, name, surface")
        .eq("tenant_id", profile!.tenant_id)
        .eq("is_active", true)
        .order("sort_order");
      return data ?? [];
    },
  });

  const courtById = new Map(courts.map((c) => [c.id, c]));
  const coachByCpId = new Map(coaches.map((c) => [c.id, c]));

  return (
    <div className="min-h-screen bg-background pb-24">
      <AppHeader memberName={profile?.first_name ?? ""} greeting="Admin · Clases" />

      <div className="mx-auto max-w-md space-y-4 px-5 pt-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="font-display text-2xl font-semibold">Clases & Coaches</h1>
            <p className="text-sm text-muted-foreground">
              Bloques horarios y liquidaciones
            </p>
          </div>
        </div>

        <Tabs defaultValue="bloques">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="bloques">
              <CalendarClock className="mr-1 h-4 w-4" /> Bloques
            </TabsTrigger>
            <TabsTrigger value="liquidaciones">
              <CircleDollarSign className="mr-1 h-4 w-4" /> Liquidaciones
            </TabsTrigger>
          </TabsList>

          <TabsContent value="bloques" className="mt-3 space-y-2">
            <Button
              variant="clay"
              className="w-full"
              onClick={() =>
                setEditing({
                  weekday: 1,
                  starts_at: "16:00",
                  ends_at: "21:00",
                  court_id: courts[0]?.id,
                  coach_id: null,
                  allow_external: true,
                })
              }
            >
              <Plus className="h-4 w-4" /> Nuevo bloque
            </Button>

            {loadingBlocks ? (
              <Skeleton className="h-24 rounded-2xl" />
            ) : blocks.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Sin bloques de clase configurados.
              </p>
            ) : (
              [0, 1, 2, 3, 4, 5, 6].map((wd) => {
                const dayBlocks = blocks.filter((b) => b.weekday === wd);
                if (!dayBlocks.length) return null;
                return (
                  <div key={wd} className="rounded-2xl border border-border bg-card p-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {WEEKDAYS[wd]}
                    </p>
                    <div className="space-y-1.5">
                      {dayBlocks.map((b) => {
                        const court = courtById.get(b.court_id);
                        const coach = b.coach_id ? coachByCpId.get(b.coach_id) : null;
                        return (
                          <div
                            key={b.id}
                            className="flex items-center justify-between rounded-xl bg-muted/30 px-3 py-2"
                          >
                            <button
                              onClick={() => setEditing(b)}
                              className="flex-1 text-left"
                            >
                              <p className="text-sm font-semibold">
                                {b.starts_at.slice(0, 5)} – {b.ends_at.slice(0, 5)}
                                <span className="ml-2 font-normal text-muted-foreground">
                                  · {court?.name ?? "—"}
                                </span>
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                {coach
                                  ? `${coach.profile?.first_name} ${coach.profile?.last_name}`
                                  : "Cualquier coach"}
                                {!b.is_active && " · INACTIVO"}
                              </p>
                            </button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                if (confirm("¿Eliminar bloque?")) remove.mutate(b.id);
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </TabsContent>

          <TabsContent value="liquidaciones" className="mt-3 space-y-2">
            {loadingSettle ? (
              <Skeleton className="h-24 rounded-2xl" />
            ) : settlements.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Sin clases completadas aún.
              </p>
            ) : (
              settlements.map((s) => (
                <div
                  key={s.coach_id}
                  className="rounded-2xl border border-border bg-card p-3 shadow-card"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={s.avatar_url ?? undefined} />
                      <AvatarFallback>
                        {s.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-display text-sm font-semibold">{s.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {s.completed_count} clases · {s.pending_count} por pagar
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-xl bg-muted/30 p-2">
                      <p className="text-muted-foreground">Por pagar</p>
                      <p className="font-display text-base font-semibold text-primary">
                        ${s.pending_clp.toLocaleString("es-CL")}
                      </p>
                    </div>
                    <div className="rounded-xl bg-muted/30 p-2">
                      <p className="text-muted-foreground">Pagado</p>
                      <p className="font-display text-base font-semibold">
                        ${s.paid_clp.toLocaleString("es-CL")}
                      </p>
                    </div>
                  </div>
                  {s.pending_count > 0 && (
                    <Button
                      variant="clay"
                      className="mt-3 w-full"
                      size="sm"
                      onClick={() => {
                        if (
                          confirm(
                            `¿Marcar como pagadas las ${s.pending_count} clases pendientes ($${s.pending_clp.toLocaleString("es-CL")})?`,
                          )
                        ) {
                          markPaid.mutate(s.coach_id);
                        }
                      }}
                      disabled={markPaid.isPending}
                    >
                      <CircleDollarSign className="h-4 w-4" /> Liquidar pendientes
                    </Button>
                  )}
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Editor de bloque */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">
              {editing?.id ? "Editar bloque" : "Nuevo bloque de clase"}
            </DialogTitle>
            <DialogDescription>
              Define qué día, cancha y horario se reserva para clases.
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label>Día</Label>
                <Select
                  value={String(editing.weekday)}
                  onValueChange={(v) =>
                    setEditing({ ...editing, weekday: Number(v) })
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {WEEKDAYS.map((d, i) => (
                      <SelectItem key={i} value={String(i)}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Inicio</Label>
                  <Input
                    type="time"
                    value={editing.starts_at?.slice(0, 5) ?? ""}
                    onChange={(e) =>
                      setEditing({ ...editing, starts_at: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>Fin</Label>
                  <Input
                    type="time"
                    value={editing.ends_at?.slice(0, 5) ?? ""}
                    onChange={(e) =>
                      setEditing({ ...editing, ends_at: e.target.value })
                    }
                  />
                </div>
              </div>
              <div>
                <Label>Cancha</Label>
                <Select
                  value={editing.court_id ?? ""}
                  onValueChange={(v) => setEditing({ ...editing, court_id: v })}
                >
                  <SelectTrigger><SelectValue placeholder="Selecciona cancha" /></SelectTrigger>
                  <SelectContent>
                    {courts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} · {c.surface}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Coach (opcional)</Label>
                <Select
                  value={editing.coach_id ?? "any"}
                  onValueChange={(v) =>
                    setEditing({ ...editing, coach_id: v === "any" ? null : v })
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Cualquier coach</SelectItem>
                    {coaches.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.profile?.first_name} {c.profile?.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {editing.id && (
                <Badge variant={editing.is_active ? "default" : "secondary"}>
                  {editing.is_active ? "Activo" : "Inactivo"}
                </Badge>
              )}
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setEditing(null)} className="flex-1">
                  Cancelar
                </Button>
                <Button
                  variant="clay"
                  className="flex-1"
                  onClick={() => {
                    upsert.mutate(editing, {
                      onSuccess: () => setEditing(null),
                    });
                  }}
                  disabled={upsert.isPending || !editing.court_id}
                >
                  Guardar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
};

export default AdminClases;
