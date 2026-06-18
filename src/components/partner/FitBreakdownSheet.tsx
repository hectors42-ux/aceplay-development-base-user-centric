import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Target, Clock, Activity, History, Cake, Layers } from "lucide-react";
import type { FitBreakdown } from "@/hooks/usePartnerSuggestions";

const SIGNALS: Array<{
  key: keyof Omit<FitBreakdown, "score">;
  label: string;
  Icon: typeof Target;
  desc: string;
}> = [
  { key: "nivel",      label: "Nivel",      Icon: Target,   desc: "Diferencia de UTR / nivel competitivo." },
  { key: "horarios",   label: "Horarios",   Icon: Clock,    desc: "Cuánto se cruzan sus disponibilidades semanales." },
  { key: "frecuencia", label: "Frecuencia", Icon: Activity, desc: "Qué tan activo está el jugador últimamente." },
  { key: "historial",  label: "Historial",  Icon: History,  desc: "Partidos previos entre ustedes + balance W-L + revancha." },
  { key: "edad",       label: "Edad",       Icon: Cake,     desc: "Cercanía de edad y años jugando." },
  { key: "superficie", label: "Superficie", Icon: Layers,   desc: "Coincidencia en superficie favorita." },
];

const barColor = (v: number | null) =>
  v == null ? "bg-muted" : v >= 75 ? "bg-success" : v >= 50 ? "bg-primary" : "bg-warning";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  breakdown: FitBreakdown | null;
  partnerName: string;
  score: number;
}

export const FitBreakdownSheet = ({ open, onOpenChange, breakdown, partnerName, score }: Props) => {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl max-h-[85vh] overflow-y-auto">
        <SheetHeader className="text-left">
          <SheetTitle className="font-display text-2xl">
            Fit {score} <span className="text-muted-foreground text-base font-sans font-normal">con {partnerName}</span>
          </SheetTitle>
          <SheetDescription>Desglose de las 6 señales que componen tu compatibilidad.</SheetDescription>
        </SheetHeader>

        <div className="mt-5 space-y-4">
          {SIGNALS.map(({ key, label, Icon, desc }) => {
            const sig = breakdown?.[key];
            const value = sig?.value ?? null;
            return (
              <div key={key} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-sm font-medium">{label}</span>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{sig?.hint ?? "—"}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className={`h-full ${barColor(value)} transition-all`} style={{ width: `${value ?? 0}%` }} />
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug">{desc}</p>
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
};
