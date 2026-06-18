import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const TIMES = ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "19:00", "20:00", "21:00"];

const buildNext48h = () => {
  const days: { iso: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 3; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    d.setHours(0, 0, 0, 0);
    days.push({
      iso: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "short" }),
    });
  }
  return days;
};

const FORMATS: { value: "1set" | "best_of_3" | "best_of_5"; label: string }[] = [
  { value: "1set", label: "1 set" },
  { value: "best_of_3", label: "Mejor de 3" },
  { value: "best_of_5", label: "Mejor de 5" },
];

export const OpenChallengeComposer = ({ open, onClose, onSuccess }: Props) => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const days = useMemo(buildNext48h, []);
  const [slots, setSlots] = useState<string[]>([]);
  const [format, setFormat] = useState<"1set" | "best_of_3" | "best_of_5">("best_of_3");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const cutoff = Date.now() + 48 * 60 * 60 * 1000;

  const toggle = (date: string, time: string) => {
    const iso = new Date(`${date}T${time}:00`).toISOString();
    setSlots((s) => (s.includes(iso) ? s.filter((x) => x !== iso) : [...s, iso]));
  };

  const submit = async () => {
    if (!user || !profile?.tenant_id) return;
    if (slots.length === 0) {
      toast({ title: "Selecciona al menos un horario", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("match_open_posts").insert({
      user_id: user.id,
      tenant_id: profile.tenant_id,
      format,
      available_slots: slots.map((iso) => ({ starts_at: iso })),
      note: note || null,
    });
    setSubmitting(false);
    if (error) {
      toast({ title: "No se pudo publicar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Reto abierto publicado", description: "Visible 48 horas para tu club." });
    setSlots([]);
    setNote("");
    onSuccess?.();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto rounded-2xl">
        <DialogHeader className="text-left">
          <DialogTitle className="font-display text-xl">Publicar reto abierto</DialogTitle>
          <DialogDescription className="text-xs">
            Tu disponibilidad será visible para tu club durante las próximas 48 horas.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Formato
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {FORMATS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setFormat(f.value)}
                className={cn(
                  "rounded-xl border px-2 py-2 text-xs font-medium transition-smooth",
                  format === f.value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background hover:bg-muted",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Horarios disponibles (próximas 48h)
          </p>
          <div className="space-y-3">
            {days.map((d) => (
              <div key={d.iso}>
                <p className="mb-1.5 text-[11px] font-medium capitalize text-foreground">
                  {d.label}
                </p>
                <div className="grid grid-cols-4 gap-1.5">
                  {TIMES.map((t) => {
                    const iso = new Date(`${d.iso}T${t}:00`).toISOString();
                    const past = new Date(iso).getTime() < Date.now();
                    const tooFar = new Date(iso).getTime() > cutoff;
                    const active = slots.includes(iso);
                    const disabled = past || tooFar;
                    return (
                      <button
                        key={t}
                        type="button"
                        disabled={disabled}
                        onClick={() => toggle(d.iso, t)}
                        className={cn(
                          "rounded-lg border px-1 py-1.5 text-xs font-medium transition-smooth",
                          disabled && "opacity-25 cursor-not-allowed",
                          active
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background hover:bg-muted",
                        )}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Nota (opcional)
          </p>
          <Textarea
            placeholder="Busco partido competitivo, set largo o tiebreak…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            maxLength={140}
          />
        </div>

        <Button
          variant="clay"
          className="mt-4 h-12 w-full text-sm font-semibold"
          onClick={submit}
          disabled={submitting || slots.length === 0}
        >
          {submitting ? "Publicando…" : `Publicar reto · ${slots.length} horario${slots.length === 1 ? "" : "s"}`}
        </Button>
      </DialogContent>
    </Dialog>
  );
};
