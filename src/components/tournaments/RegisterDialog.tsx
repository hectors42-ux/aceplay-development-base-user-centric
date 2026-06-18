import { useState } from "react";
import { CalendarPlus, CheckCircle2, Info, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { PartnerPicker } from "@/components/PartnerPicker";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Category } from "@/hooks/useCategoryData";
import { useTournamentSessions } from "@/hooks/useTournamentSessions";
import { useTournamentRules } from "@/hooks/useTournamentRules";
import { useTournamentCobrand } from "@/hooks/useTournamentCobrand";
import {
  downloadTournamentSessionsIcs,
  type TournamentIcsSession,
} from "@/lib/ics";
import { trackEvent } from "@/lib/analytics";

interface RegisterDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  category: Category | null;
  onRegistered: () => void;
}

export const RegisterDialog = ({
  open,
  onOpenChange,
  category,
  onRegistered,
}: RegisterDialogProps) => {
  const { profile } = useAuth();
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sessionAvailability, setSessionAvailability] = useState<string[]>([]);
  const [acceptedRules, setAcceptedRules] = useState(false);
  const tournamentId = (category as { tournament_id?: string } | null)?.tournament_id ?? null;
  const { sessions } = useTournamentSessions(tournamentId);
  const { rules } = useTournamentRules(tournamentId);
  const { cobrand } = useTournamentCobrand(tournamentId);
  const [confirmedSessions, setConfirmedSessions] = useState<TournamentIcsSession[]>([]);
  const [tournamentName, setTournamentName] = useState<string>("");

  const motor = (category as { motor?: string } | null)?.motor;
  const isAmericanoRotacion = motor === "americano_rotacion";
  const isDoubles =
    !isAmericanoRotacion &&
    (category?.discipline === "tenis_dobles" || category?.discipline === "padel_dobles");

  if (!category) return null;

  const handleSubmit = async () => {
    if (isDoubles && !partnerId) {
      toast({ title: "Elige una pareja", variant: "destructive" });
      return;
    }
    if (sessions.length > 0 && sessionAvailability.length === 0) {
      toast({
        title: "Confirma al menos una sesión",
        description: "Marca tus disponibilidades antes de inscribirte.",
        variant: "destructive",
      });
      return;
    }
    if (rules && !acceptedRules) {
      toast({
        title: "Acepta el reglamento",
        description: "Debes aceptar las reglas del torneo para inscribirte.",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.rpc("register_to_category", {
      _category_id: category.id,
      _player2_user_id: isDoubles ? partnerId ?? undefined : undefined,
      _session_availability: sessions.length > 0 ? sessionAvailability : [],
    } as never);
    setSubmitting(false);
    if (error) {
      toast({ title: "No se pudo inscribir", description: error.message, variant: "destructive" });
      return;
    }
    if (rules && profile?.id) {
      // Persist accepted rules version on the registration just created.
      await supabase
        .from("tournament_registrations")
        .update({
          rules_version_accepted: rules.version,
          rules_accepted_at: new Date().toISOString(),
        } as never)
        .eq("tournament_category_id", category.id)
        .eq("player1_user_id", profile.id);
    }
    const picked = sessions.filter((s) => sessionAvailability.includes(s.id));
    if (picked.length > 0 && tournamentId) {
      // Cargar nombre del torneo para el ICS y mostrar estado success con CTA.
      const { data: t } = await supabase
        .from("tournaments")
        .select("name")
        .eq("id", tournamentId)
        .maybeSingle();
      setTournamentName((t as { name?: string } | null)?.name ?? "Torneo");
      setConfirmedSessions(
        picked.map((s) => ({
          id: s.id,
          name: s.name,
          starts_at: s.starts_at,
          ends_at: s.ends_at,
        })),
      );
      onRegistered();
      return;
    }
    toast({
      title: isDoubles ? "Invitación enviada a tu pareja" : "Inscripción enviada",
      description: isDoubles
        ? "Quedará confirmada cuando tu pareja acepte y el admin apruebe."
        : "El admin revisará tu inscripción.",
    });
    setPartnerId(null);
    setSessionAvailability([]);
    setAcceptedRules(false);
    onOpenChange(false);
    onRegistered();
  };

  const handleDownloadIcs = () => {
    if (!tournamentId || confirmedSessions.length === 0) return;
    downloadTournamentSessionsIcs({
      tournament_id: tournamentId,
      tournament_name: tournamentName || "Torneo",
      cobrand_name: cobrand?.display_name ?? null,
      club_address: null,
      sessions: confirmedSessions,
    });
    trackEvent("calendar_ics_downloaded", {
      tournament_id: tournamentId,
      count: confirmedSessions.length,
    });
  };

  const handleSuccessClose = () => {
    setPartnerId(null);
    setSessionAvailability([]);
    setAcceptedRules(false);
    setConfirmedSessions([]);
    setTournamentName("");
    onOpenChange(false);
  };

  const toggleSession = (id: string, on: boolean) => {
    setSessionAvailability((prev) =>
      on ? Array.from(new Set([...prev, id])) : prev.filter((x) => x !== id),
    );
  };

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("es-CL", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

  if (confirmedSessions.length > 0) {
    return (
      <Dialog open={open} onOpenChange={(v) => (v ? null : handleSuccessClose())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              Inscripción enviada
            </DialogTitle>
            <DialogDescription>
              {isDoubles
                ? "Quedará confirmada cuando tu pareja acepte y el admin apruebe."
                : "El admin revisará tu inscripción."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Sesiones confirmadas
            </p>
            <ul className="space-y-1.5 rounded-xl border border-border bg-card px-3 py-2 text-sm">
              {confirmedSessions.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3">
                  <span className="truncate font-medium">{s.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{fmt(s.starts_at)}</span>
                </li>
              ))}
            </ul>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button onClick={handleDownloadIcs} className="w-full">
              <CalendarPlus className="mr-2 h-4 w-4" />
              Agregar a mi calendario (.ics)
            </Button>
            <Button variant="outline" onClick={handleSuccessClose} className="w-full">
              Listo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Inscribirse · {category.name}</DialogTitle>
          <DialogDescription>
            {isDoubles
              ? "Busca a tu pareja por nombre. Debe aceptar la invitación antes de que la inscripción quede pendiente de aprobación."
              : "El admin del torneo confirmará tu inscripción."}
          </DialogDescription>
        </DialogHeader>

        {isDoubles && (
          <div className="space-y-2 py-2">
            <Label>Pareja</Label>
            <PartnerPicker value={partnerId} onChange={(id) => setPartnerId(id)} />
          </div>
        )}

        {sessions.length > 0 && (
          <div className="space-y-3 py-2">
            <Label className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Confirmo mi disponibilidad
            </Label>
            <div className="space-y-2">
              {sessions.map((s) => {
                const on = sessionAvailability.includes(s.id);
                return (
                  <label
                    key={s.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{s.name}</p>
                      <p className="text-xs text-muted-foreground">{fmt(s.starts_at)}</p>
                    </div>
                    <Switch checked={on} onCheckedChange={(v) => toggleSession(s.id, v)} />
                  </label>
                );
              })}
            </div>
            <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
              <Info className="mt-0.5 h-3 w-3 shrink-0" />
              El sorteo solo te agenda en las sesiones que confirmes.
            </p>
          </div>
        )}

        {rules && (
          <label className="flex items-start gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-xs">
            <Checkbox
              checked={acceptedRules}
              onCheckedChange={(v) => setAcceptedRules(v === true)}
              className="mt-0.5"
            />
            <span className="leading-snug text-muted-foreground">
              Acepto el{" "}
              <span className="font-semibold text-foreground">reglamento v{rules.version}</span>{" "}
              del torneo, incluyendo los derechos de imagen y las reglas de juego.
            </span>
          </label>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Inscribirme
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
