import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Loader2,
  Save,
  UserPlus,
  ArrowUp,
  ArrowDown,
  Trash2,
  History as HistoryIcon,
  Crown,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/EmptyState";
import { toast } from "@/hooks/use-toast";
import { VALIDATION_MODE_LABEL, type ResultValidationMode } from "@/lib/tournament-utils";
import type { Database, Tables } from "@/integrations/supabase/types";

type LadderRow = Tables<"ladders">;
type PositionRow = Tables<"ladder_positions">;
type HistoryRow = Tables<"ladder_history">;
type ProfileLite = {
  user_id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
};

type HistoryReason = Database["public"]["Enums"]["ladder_history_reason"];

const REASON_LABEL: Record<HistoryReason, string> = {
  ingreso: "Ingreso",
  retiro: "Retiro",
  desafio_ganado: "Desafío ganado",
  desafio_perdido: "Desafío perdido",
  walkover: "Walkover",
  inactividad: "Inactividad",
  ajuste_admin: "Ajuste admin",
};

const initials = (f: string, l: string) =>
  `${f?.[0] ?? ""}${l?.[0] ?? ""}`.toUpperCase();

const AdminLadderDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const [ladder, setLadder] = useState<LadderRow | null>(null);
  const [positions, setPositions] = useState<PositionRow[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [profilesById, setProfilesById] = useState<Record<string, ProfileLite>>({});
  const [allMembers, setAllMembers] = useState<ProfileLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingParams, setSavingParams] = useState(false);

  // Params edición
  const [name, setName] = useState("");
  const [validationMode, setValidationMode] =
    useState<ResultValidationMode>("jugadores_con_confirmacion");
  const [challengeWindow, setChallengeWindow] = useState(7);
  const [responseWindow, setResponseWindow] = useState(48);
  const [maxJump, setMaxJump] = useState(3);
  const [cooldown, setCooldown] = useState(3);
  const [inactivityDays, setInactivityDays] = useState(30);
  const [inactivityDrop, setInactivityDrop] = useState(1);

  // Add player
  const [addOpen, setAddOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<string>("");
  const [adding, setAdding] = useState(false);

  // Filtros historial
  const [reasonFilter, setReasonFilter] = useState<"todos" | HistoryReason>("todos");
  const [userFilter, setUserFilter] = useState<string>("todos");

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const [ladderRes, posRes, histRes] = await Promise.all([
      supabase.from("ladders").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("ladder_positions")
        .select("*")
        .eq("ladder_id", id)
        .order("position", { ascending: true }),
      supabase
        .from("ladder_history")
        .select("*")
        .eq("ladder_id", id)
        .order("recorded_at", { ascending: false })
        .limit(200),
    ]);

    const l = (ladderRes.data ?? null) as LadderRow | null;
    const pos = (posRes.data ?? []) as PositionRow[];
    const hist = (histRes.data ?? []) as HistoryRow[];

    setLadder(l);
    setPositions(pos);
    setHistory(hist);

    if (l) {
      setName(l.name);
      setValidationMode(l.result_validation_mode);
      setChallengeWindow(l.challenge_window_days);
      setResponseWindow(l.response_window_hours);
      setMaxJump(l.max_position_jump);
      setCooldown(l.cooldown_days);
      setInactivityDays(l.inactivity_days);
      setInactivityDrop(l.inactivity_drop_positions);
    }

    const ids = new Set<string>();
    pos.forEach((p) => ids.add(p.user_id));
    hist.forEach((h) => ids.add(h.user_id));
    if (ids.size > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, avatar_url")
        .in("user_id", Array.from(ids));
      const map: Record<string, ProfileLite> = {};
      ((profs ?? []) as ProfileLite[]).forEach((p) => (map[p.user_id] = p));
      setProfilesById(map);
    }

    // Cargar socios del club para "agregar manualmente"
    if (profile?.tenant_id) {
      const { data: members } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, avatar_url")
        .eq("tenant_id", profile.tenant_id)
        .order("first_name", { ascending: true });
      setAllMembers((members ?? []) as ProfileLite[]);
    }

    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, profile?.tenant_id]);

  const enrolledIds = useMemo(
    () => new Set(positions.map((p) => p.user_id)),
    [positions],
  );

  const availableMembers = useMemo(
    () => allMembers.filter((m) => !enrolledIds.has(m.user_id)),
    [allMembers, enrolledIds],
  );

  const filteredHistory = useMemo(() => {
    return history.filter((h) => {
      if (reasonFilter !== "todos" && h.reason !== reasonFilter) return false;
      if (userFilter !== "todos" && h.user_id !== userFilter) return false;
      return true;
    });
  }, [history, reasonFilter, userFilter]);

  const handleSaveParams = async () => {
    if (!ladder) return;
    setSavingParams(true);
    const { error } = await supabase
      .from("ladders")
      .update({
        name: name.trim(),
        result_validation_mode: validationMode,
        challenge_window_days: challengeWindow,
        response_window_hours: responseWindow,
        max_position_jump: maxJump,
        cooldown_days: cooldown,
        inactivity_days: inactivityDays,
        inactivity_drop_positions: inactivityDrop,
      })
      .eq("id", ladder.id);
    setSavingParams(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Parámetros guardados" });
    void load();
  };

  const handleAddPlayer = async () => {
    if (!selectedMember || !ladder || !profile) return;
    setAdding(true);
    const nextPos = positions.length + 1;
    const { error } = await supabase.from("ladder_positions").insert({
      ladder_id: ladder.id,
      tenant_id: profile.tenant_id,
      user_id: selectedMember,
      position: nextPos,
      status: "activo",
    });
    if (!error) {
      // Audit
      await supabase.from("ladder_history").insert({
        ladder_id: ladder.id,
        tenant_id: profile.tenant_id,
        user_id: selectedMember,
        reason: "ingreso",
        position_after: nextPos,
        notes: "Agregado por admin",
      });
    }
    setAdding(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Jugador agregado" });
    setAddOpen(false);
    setSelectedMember("");
    void load();
  };

  const swapPositions = async (a: PositionRow, b: PositionRow) => {
    if (!ladder || !profile) return;
    const TEMP_OFFSET = 10000;
    // a -> temp
    const r1 = await supabase
      .from("ladder_positions")
      .update({ position: TEMP_OFFSET + a.position })
      .eq("id", a.id);
    if (r1.error) {
      toast({ title: "Error", description: r1.error.message, variant: "destructive" });
      return;
    }
    // b -> a.position
    const r2 = await supabase
      .from("ladder_positions")
      .update({ position: a.position })
      .eq("id", b.id);
    if (r2.error) {
      toast({ title: "Error", description: r2.error.message, variant: "destructive" });
      return;
    }
    // a (temp) -> b.position
    const r3 = await supabase
      .from("ladder_positions")
      .update({ position: b.position })
      .eq("id", a.id);
    if (r3.error) {
      toast({ title: "Error", description: r3.error.message, variant: "destructive" });
      return;
    }
    // Audit
    await supabase.from("ladder_history").insert([
      {
        ladder_id: ladder.id,
        tenant_id: profile.tenant_id,
        user_id: a.user_id,
        reason: "ajuste_admin",
        position_before: a.position,
        position_after: b.position,
        notes: "Reordenado por admin",
      },
      {
        ladder_id: ladder.id,
        tenant_id: profile.tenant_id,
        user_id: b.user_id,
        reason: "ajuste_admin",
        position_before: b.position,
        position_after: a.position,
        notes: "Reordenado por admin",
      },
    ]);
    toast({ title: "Posiciones intercambiadas" });
    void load();
  };

  const movePlayer = (p: PositionRow, dir: "up" | "down") => {
    const idx = positions.findIndex((x) => x.id === p.id);
    if (idx < 0) return;
    const target = dir === "up" ? positions[idx - 1] : positions[idx + 1];
    if (!target) return;
    void swapPositions(p, target);
  };

  const removePlayer = async (p: PositionRow) => {
    if (!ladder || !profile) return;
    if (!confirm(`¿Quitar a este jugador de la Escalerilla?`)) return;
    const { error } = await supabase.from("ladder_positions").delete().eq("id", p.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    // Recompactar posiciones de quienes estaban debajo (en dos pasos para evitar colisiones)
    const below = positions.filter((x) => x.position > p.position);
    const TEMP_OFFSET = 20000;
    for (const b of below) {
      await supabase
        .from("ladder_positions")
        .update({ position: TEMP_OFFSET + b.position })
        .eq("id", b.id);
    }
    for (const b of below) {
      await supabase
        .from("ladder_positions")
        .update({ position: b.position - 1 })
        .eq("id", b.id);
    }
    await supabase.from("ladder_history").insert({
      ladder_id: ladder.id,
      tenant_id: profile.tenant_id,
      user_id: p.user_id,
      reason: "retiro",
      position_before: p.position,
      notes: "Retirado por admin",
    });
    toast({ title: "Jugador retirado" });
    void load();
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!ladder) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <p className="text-sm text-muted-foreground">Escalerilla no encontrada</p>
        <Link to="/admin/ladder" className="text-primary underline-offset-4 hover:underline">
          Volver
        </Link>
      </div>
    );
  }

  const playersInHistory = Array.from(new Set(history.map((h) => h.user_id)));

  return (
    <div className="min-h-screen bg-gradient-warm pb-12">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-5 py-4">
          <Link
            to="/admin/ladder"
            className="flex h-9 w-9 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground hover:text-foreground"
            aria-label="Volver"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-xl font-semibold">{ladder.name}</h1>
            <p className="text-xs text-muted-foreground">
              {positions.length} jugador{positions.length === 1 ? "" : "es"}
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 pt-4">
        <Tabs defaultValue="jugadores" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="jugadores" className="text-xs">
              Jugadores
            </TabsTrigger>
            <TabsTrigger value="parametros" className="text-xs">
              Parámetros
            </TabsTrigger>
            <TabsTrigger value="historial" className="text-xs">
              Historial
            </TabsTrigger>
          </TabsList>

          {/* JUGADORES */}
          <TabsContent value="jugadores" className="mt-4 space-y-3">
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setAddOpen(true)} disabled={availableMembers.length === 0}>
                <UserPlus className="mr-1 h-4 w-4" /> Agregar jugador
              </Button>
            </div>
            {positions.length === 0 ? (
              <EmptyState
                icon={UserPlus}
                title="Sin jugadores"
                description="Agrega socios manualmente o invítalos a unirse desde la app."
              />
            ) : (
              <ul className="space-y-2">
                {positions.map((p, idx) => {
                  const prof = profilesById[p.user_id];
                  return (
                    <li
                      key={p.id}
                      className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-card"
                    >
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl font-display text-sm font-bold ${
                          p.position === 1
                            ? "bg-gradient-clay text-primary-foreground shadow-clay"
                            : "bg-muted text-foreground"
                        }`}
                      >
                        {p.position === 1 ? <Crown className="h-5 w-5" /> : `#${p.position}`}
                      </div>
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={prof?.avatar_url ?? undefined} />
                        <AvatarFallback className="text-[11px]">
                          {prof ? initials(prof.first_name, prof.last_name) : "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {prof ? `${prof.first_name} ${prof.last_name}` : "Jugador"}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {p.wins}V · {p.losses}D
                          {p.status !== "activo" && (
                            <span className="ml-1 text-warning">· {p.status}</span>
                          )}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => movePlayer(p, "up")}
                          disabled={idx === 0}
                          aria-label="Subir"
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => movePlayer(p, "down")}
                          disabled={idx === positions.length - 1}
                          aria-label="Bajar"
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => removePlayer(p)}
                          aria-label="Quitar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </TabsContent>

          {/* PARAMETROS */}
          <TabsContent value="parametros" className="mt-4 space-y-3">
            <div className="space-y-3 rounded-3xl border border-border bg-card p-4 shadow-card">
              <div>
                <Label htmlFor="p-name">Nombre</Label>
                <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <Label>Validación de resultados</Label>
                <Select
                  value={validationMode}
                  onValueChange={(v) => setValidationMode(v as ResultValidationMode)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(VALIDATION_MODE_LABEL) as ResultValidationMode[]).map((m) => (
                      <SelectItem key={m} value={m}>
                        {VALIDATION_MODE_LABEL[m]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="p-cw">Ventana desafío (días)</Label>
                  <Input
                    id="p-cw"
                    type="number"
                    min={1}
                    value={challengeWindow}
                    onChange={(e) => setChallengeWindow(Number(e.target.value))}
                  />
                </div>
                <div>
                  <Label htmlFor="p-rw">Ventana respuesta (h)</Label>
                  <Input
                    id="p-rw"
                    type="number"
                    min={1}
                    value={responseWindow}
                    onChange={(e) => setResponseWindow(Number(e.target.value))}
                  />
                </div>
                <div>
                  <Label htmlFor="p-mj">Máx. salto</Label>
                  <Input
                    id="p-mj"
                    type="number"
                    min={1}
                    value={maxJump}
                    onChange={(e) => setMaxJump(Number(e.target.value))}
                  />
                </div>
                <div>
                  <Label htmlFor="p-cd">Cooldown (días)</Label>
                  <Input
                    id="p-cd"
                    type="number"
                    min={0}
                    value={cooldown}
                    onChange={(e) => setCooldown(Number(e.target.value))}
                  />
                </div>
                <div>
                  <Label htmlFor="p-id">Inactividad (días)</Label>
                  <Input
                    id="p-id"
                    type="number"
                    min={1}
                    value={inactivityDays}
                    onChange={(e) => setInactivityDays(Number(e.target.value))}
                  />
                </div>
                <div>
                  <Label htmlFor="p-idr">Descenso por inactividad</Label>
                  <Input
                    id="p-idr"
                    type="number"
                    min={0}
                    value={inactivityDrop}
                    onChange={(e) => setInactivityDrop(Number(e.target.value))}
                  />
                </div>
              </div>
              <Button onClick={handleSaveParams} disabled={savingParams} className="w-full">
                {savingParams ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Save className="mr-1 h-4 w-4" /> Guardar cambios
                  </>
                )}
              </Button>
            </div>
          </TabsContent>

          {/* HISTORIAL */}
          <TabsContent value="historial" className="mt-4 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Select value={reasonFilter} onValueChange={(v) => setReasonFilter(v as typeof reasonFilter)}>
                <SelectTrigger>
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los motivos</SelectItem>
                  {(Object.keys(REASON_LABEL) as HistoryReason[]).map((r) => (
                    <SelectItem key={r} value={r}>
                      {REASON_LABEL[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={userFilter} onValueChange={setUserFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Jugador" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los jugadores</SelectItem>
                  {playersInHistory.map((uid) => {
                    const p = profilesById[uid];
                    return (
                      <SelectItem key={uid} value={uid}>
                        {p ? `${p.first_name} ${p.last_name}` : "Jugador"}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {filteredHistory.length === 0 ? (
              <EmptyState
                icon={HistoryIcon}
                title="Sin movimientos"
                description="Aún no hay registros que coincidan con el filtro."
              />
            ) : (
              <ul className="space-y-2">
                {filteredHistory.map((h) => {
                  const prof = profilesById[h.user_id];
                  const movement =
                    h.position_before != null && h.position_after != null
                      ? h.position_after < h.position_before
                        ? "up"
                        : h.position_after > h.position_before
                          ? "down"
                          : "same"
                      : null;
                  return (
                    <li
                      key={h.id}
                      className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-card"
                    >
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={prof?.avatar_url ?? undefined} />
                        <AvatarFallback className="text-[11px]">
                          {prof ? initials(prof.first_name, prof.last_name) : "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {prof ? `${prof.first_name} ${prof.last_name}` : "Jugador"}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {REASON_LABEL[h.reason]} ·{" "}
                          {format(parseISO(h.recorded_at), "d MMM HH:mm", { locale: es })}
                          {h.notes ? ` · ${h.notes}` : ""}
                        </p>
                      </div>
                      {h.position_before != null && h.position_after != null && (
                        <div className="flex shrink-0 items-center gap-1 text-xs font-medium">
                          <span className="text-muted-foreground">#{h.position_before}</span>
                          <span className="text-muted-foreground">→</span>
                          <span
                            className={
                              movement === "up"
                                ? "text-success"
                                : movement === "down"
                                  ? "text-destructive"
                                  : ""
                            }
                          >
                            #{h.position_after}
                          </span>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </TabsContent>
        </Tabs>
      </main>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Agregar jugador</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label>Socio</Label>
            <Select value={selectedMember} onValueChange={setSelectedMember}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un socio" />
              </SelectTrigger>
              <SelectContent>
                {availableMembers.map((m) => (
                  <SelectItem key={m.user_id} value={m.user_id}>
                    {m.first_name} {m.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Se agregará al final de la Escalerilla (posición #{positions.length + 1}).
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddPlayer} disabled={!selectedMember || adding}>
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : "Agregar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminLadderDetail;
