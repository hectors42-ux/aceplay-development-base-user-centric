import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Swords, Loader2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { EmptyState } from "@/components/EmptyState";
import { toast } from "@/hooks/use-toast";
import {
  DISCIPLINE_LABEL,
  GENDER_LABEL,
  SURFACE_LABEL,
  VALIDATION_MODE_LABEL,
  type CategoryGender,
  type CourtSurface,
  type ResultValidationMode,
  type TournamentDiscipline,
} from "@/lib/tournament-utils";
import type { Tables } from "@/integrations/supabase/types";

type LadderRow = Tables<"ladders"> & {
  ladder_positions: { count: number }[];
};

const AdminLadder = () => {
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const [ladders, setLadders] = useState<LadderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [discipline, setDiscipline] = useState<TournamentDiscipline>("tenis_singles");
  const [gender, setGender] = useState<CategoryGender>("mixto");
  const [surface, setSurface] = useState<CourtSurface>("arcilla");
  const [validationMode, setValidationMode] =
    useState<ResultValidationMode>("jugadores_con_confirmacion");
  const [challengeWindow, setChallengeWindow] = useState(7);
  const [responseWindow, setResponseWindow] = useState(48);
  const [maxJump, setMaxJump] = useState(3);
  const [cooldown, setCooldown] = useState(3);
  const [inactivityDays, setInactivityDays] = useState(30);
  const [inactivityDrop, setInactivityDrop] = useState(1);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("ladders")
      .select("*, ladder_positions(count)")
      .order("created_at", { ascending: false });
    setLadders((data ?? []) as LadderRow[]);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const resetForm = () => {
    setName("");
    setDescription("");
    setDiscipline("tenis_singles");
    setGender("mixto");
    setSurface("arcilla");
    setValidationMode("jugadores_con_confirmacion");
    setChallengeWindow(7);
    setResponseWindow(48);
    setMaxJump(3);
    setCooldown(3);
    setInactivityDays(30);
    setInactivityDrop(1);
  };

  const handleCreate = async () => {
    if (!profile || !user) return;
    if (!name.trim()) {
      toast({ title: "Falta el nombre", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("ladders").insert({
      tenant_id: profile.tenant_id,
      name: name.trim(),
      description: description.trim() || null,
      discipline,
      gender,
      surface,
      result_validation_mode: validationMode,
      challenge_window_days: challengeWindow,
      response_window_hours: responseWindow,
      max_position_jump: maxJump,
      cooldown_days: cooldown,
      inactivity_days: inactivityDays,
      inactivity_drop_positions: inactivityDrop,
      is_active: true,
      created_by: user.id,
    });
    setSubmitting(false);
    if (error) {
      toast({ title: "Error al crear", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Escalerilla creada" });
    setCreateOpen(false);
    resetForm();
    void load();
  };

  const toggleActive = async (id: string, current: boolean) => {
    const { error } = await supabase
      .from("ladders")
      .update({ is_active: !current })
      .eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: current ? "Escalerilla pausada" : "Escalerilla activada" });
    void load();
  };

  return (
    <div className="min-h-screen bg-gradient-warm pb-12">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-5 py-4">
          <Link
            to="/ladder"
            className="flex h-9 w-9 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground hover:text-foreground"
            aria-label="Volver"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1">
            <h1 className="font-display text-xl font-semibold">Administrar Escalerillas</h1>
            <p className="text-xs text-muted-foreground">Crear, configurar y supervisar Escalerillas del club</p>
          </div>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1 h-4 w-4" /> Nueva
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-3 px-5 pt-4">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : ladders.length === 0 ? (
          <EmptyState
            icon={Swords}
            title="Sin Escalerillas"
            description="Crea la primera Escalerilla para que los socios empiecen a desafiarse."
          />
        ) : (
          ladders.map((l) => {
            const playerCount = l.ladder_positions?.[0]?.count ?? 0;
            return (
              <div
                key={l.id}
                className="rounded-3xl border border-border bg-card p-4 shadow-card"
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-display text-base font-semibold">{l.name}</h3>
                      {!l.is_active && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                          Pausada
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {DISCIPLINE_LABEL[l.discipline]} · {GENDER_LABEL[l.gender]} ·{" "}
                      {SURFACE_LABEL[l.surface]}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {playerCount} jugador{playerCount === 1 ? "" : "es"} · creada{" "}
                      {format(parseISO(l.created_at), "d MMM yyyy", { locale: es })}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate(`/admin/ladder/${l.id}`)}
                  >
                    Gestionar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => toggleActive(l.id, l.is_active)}
                  >
                    {l.is_active ? "Pausar" : "Activar"}
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </main>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nueva Escalerilla</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label htmlFor="l-name">Nombre</Label>
              <Input
                id="l-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Escalerilla Singles 2026"
              />
            </div>
            <div>
              <Label htmlFor="l-desc">Descripción</Label>
              <Textarea
                id="l-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Disciplina</Label>
                <Select
                  value={discipline}
                  onValueChange={(v) => setDiscipline(v as TournamentDiscipline)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(DISCIPLINE_LABEL) as TournamentDiscipline[]).map((d) => (
                      <SelectItem key={d} value={d}>
                        {DISCIPLINE_LABEL[d]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Categoría</Label>
                <Select value={gender} onValueChange={(v) => setGender(v as CategoryGender)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(GENDER_LABEL) as CategoryGender[]).map((g) => (
                      <SelectItem key={g} value={g}>
                        {GENDER_LABEL[g]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Superficie</Label>
                <Select value={surface} onValueChange={(v) => setSurface(v as CourtSurface)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(SURFACE_LABEL) as CourtSurface[]).map((s) => (
                      <SelectItem key={s} value={s}>
                        {SURFACE_LABEL[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div>
                <Label htmlFor="l-cw">Ventana desafío (días)</Label>
                <Input
                  id="l-cw"
                  type="number"
                  min={1}
                  value={challengeWindow}
                  onChange={(e) => setChallengeWindow(Number(e.target.value))}
                />
              </div>
              <div>
                <Label htmlFor="l-rw">Ventana respuesta (h)</Label>
                <Input
                  id="l-rw"
                  type="number"
                  min={1}
                  value={responseWindow}
                  onChange={(e) => setResponseWindow(Number(e.target.value))}
                />
              </div>
              <div>
                <Label htmlFor="l-mj">Máx. salto posiciones</Label>
                <Input
                  id="l-mj"
                  type="number"
                  min={1}
                  value={maxJump}
                  onChange={(e) => setMaxJump(Number(e.target.value))}
                />
              </div>
              <div>
                <Label htmlFor="l-cd">Cooldown (días)</Label>
                <Input
                  id="l-cd"
                  type="number"
                  min={0}
                  value={cooldown}
                  onChange={(e) => setCooldown(Number(e.target.value))}
                />
              </div>
              <div>
                <Label htmlFor="l-id">Inactividad (días)</Label>
                <Input
                  id="l-id"
                  type="number"
                  min={1}
                  value={inactivityDays}
                  onChange={(e) => setInactivityDays(Number(e.target.value))}
                />
              </div>
              <div>
                <Label htmlFor="l-idr">Descenso por inactividad</Label>
                <Input
                  id="l-idr"
                  type="number"
                  min={0}
                  value={inactivityDrop}
                  onChange={(e) => setInactivityDrop(Number(e.target.value))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crear Escalerilla"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminLadder;
