import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useUserAvailability, type AvailabilitySlot } from "@/hooks/useUserAvailability";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const DAYS = [
  { id: 1, label: "Lun" },
  { id: 2, label: "Mar" },
  { id: 3, label: "Mié" },
  { id: 4, label: "Jue" },
  { id: 5, label: "Vie" },
  { id: 6, label: "Sáb" },
  { id: 0, label: "Dom" },
];

const BANDS = [
  { key: "morning", label: "Mañana", starts: "08:00", ends: "12:00" },
  { key: "afternoon", label: "Tarde", starts: "12:00", ends: "18:00" },
  { key: "evening", label: "Noche", starts: "18:00", ends: "22:00" },
];

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export const PartnerOnboardingSheet = ({ open, onClose, onSaved }: Props) => {
  const { slots: existing, saveAll } = useUserAvailability();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!open) return;
    const next = new Set<string>();
    existing.forEach((s) => {
      const band = BANDS.find(
        (b) => b.starts === s.starts_at.slice(0, 5) && b.ends === s.ends_at.slice(0, 5),
      );
      if (band) next.add(`${s.weekday}_${band.key}`);
    });
    setSelected(next);
  }, [open, existing]);

  const toggle = (weekday: number, bandKey: string) => {
    const key = `${weekday}_${bandKey}`;
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleSave = async () => {
    if (selected.size === 0) {
      toast({ title: "Selecciona al menos una franja", variant: "destructive" });
      return;
    }
    setSaving(true);
    const slots: Omit<AvailabilitySlot, "id">[] = Array.from(selected).map((key) => {
      const [wd, bk] = key.split("_");
      const band = BANDS.find((b) => b.key === bk)!;
      return {
        weekday: Number(wd),
        starts_at: band.starts,
        ends_at: band.ends,
        is_active: true,
      };
    });
    await saveAll(slots);
    setSaving(false);
    toast({ title: "Disponibilidad guardada" });
    onSaved?.();
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto rounded-t-3xl">
        <SheetHeader className="text-left">
          <SheetTitle className="font-display">Tu disponibilidad</SheetTitle>
          <SheetDescription>
            Marca cuándo sueles poder jugar. Lo usamos para sugerirte partners compatibles.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {BANDS.map((band) => (
            <div key={band.key}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {band.label}{" "}
                <span className="font-normal normal-case">
                  ({band.starts}–{band.ends})
                </span>
              </p>
              <div className="grid grid-cols-7 gap-1.5">
                {DAYS.map((d) => {
                  const key = `${d.id}_${band.key}`;
                  const active = selected.has(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggle(d.id, band.key)}
                      className={cn(
                        "rounded-xl border px-1 py-2 text-xs font-medium transition-smooth",
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card hover:bg-muted",
                      )}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="sticky bottom-0 mt-6 -mx-6 border-t border-border bg-background px-6 py-4">
          <Button
            variant="clay"
            className="w-full"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Guardando…" : "Guardar disponibilidad"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
