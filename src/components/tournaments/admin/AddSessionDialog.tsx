import { useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import type { TournamentSession } from "@/hooks/useTournamentSessions";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tournamentId: string;
  previousSession: TournamentSession | null;
  onCreated: () => void;
}

const toLocalInputValue = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const AddSessionDialog = ({
  open,
  onOpenChange,
  tournamentId,
  previousSession,
  onCreated,
}: Props) => {
  const { profile, user } = useAuth();
  const [name, setName] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [duplicateCourts, setDuplicateCourts] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim() || !startsAt || !endsAt) {
      toast({ title: "Completa todos los campos", variant: "destructive" });
      return;
    }
    if (new Date(endsAt) <= new Date(startsAt)) {
      toast({ title: "El fin debe ser posterior al inicio", variant: "destructive" });
      return;
    }
    if (!profile?.tenant_id || !user) return;
    setSubmitting(true);
    const courtIds =
      duplicateCourts && previousSession ? previousSession.court_ids : [];
    const { error } = await supabase.from("tournament_sessions" as never).insert({
      tournament_id: tournamentId,
      tenant_id: profile.tenant_id,
      name: name.trim(),
      starts_at: new Date(startsAt).toISOString(),
      ends_at: new Date(endsAt).toISOString(),
      court_ids: courtIds,
      created_by: user.id,
    } as never);
    setSubmitting(false);
    if (error) {
      toast({ title: "No se pudo crear", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Sesión creada" });
    setName("");
    setStartsAt("");
    setEndsAt("");
    onOpenChange(false);
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agregar sesión</DialogTitle>
          <DialogDescription>
            Define una ventana de juego con su rango horario y canchas.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label htmlFor="session-name">Nombre</Label>
            <Input
              id="session-name"
              placeholder="Sesión 1 · Mié"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="session-start">Inicio</Label>
              <Input
                id="session-start"
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="session-end">Fin</Label>
              <Input
                id="session-end"
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
              />
            </div>
          </div>
          {previousSession && (
            <label className="flex items-start gap-2 rounded-xl border border-border bg-muted/30 p-3 text-xs">
              <Checkbox
                checked={duplicateCourts}
                onCheckedChange={(v) => setDuplicateCourts(v === true)}
                className="mt-0.5"
              />
              <span>
                Duplicar canchas de <strong>{previousSession.name}</strong> ({previousSession.court_ids.length})
              </span>
            </label>
          )}
          {previousSession && (
            <button
              type="button"
              className="text-[11px] text-muted-foreground underline"
              onClick={() => {
                setStartsAt(toLocalInputValue(previousSession.starts_at));
                setEndsAt(toLocalInputValue(previousSession.ends_at));
              }}
            >
              Copiar horario de la sesión anterior
            </button>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Crear sesión
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};