import { Switch } from "@/components/ui/switch";
import { HapticButton } from "@/components/feedback/HapticButton";
import { Route } from "lucide-react";

interface Props {
  active: boolean;
  onToggle: (next: boolean) => void;
  stepsAhead: number;
  isOut: boolean;
  userInitials?: string;
}

export function MyPathToggle({ active, onToggle, stepsAhead, isOut, userInitials }: Props) {
  const subtitle = active
    ? isOut
      ? "Tu camino terminó · vuelve al próximo"
      : stepsAhead > 0
        ? `${stepsAhead} partido${stepsAhead === 1 ? "" : "s"} hasta el título`
        : "Sin partidos pendientes"
    : "aísla tu ruta al título";
  return (
    <HapticButton
      level="light"
      type="button"
      onClick={() => onToggle(!active)}
      className={`flex w-full items-center justify-between rounded-2xl p-3 transition-all duration-200 ${
        active
          ? "border-[1.5px] border-primary/40 bg-gradient-to-r from-primary/10 to-card"
          : "border border-border bg-card"
      }`}
    >
      <div className="flex items-center gap-2.5">
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold ${
            active
              ? "bg-primary text-primary-foreground ring-2 ring-primary/30"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {userInitials ?? <Route className="h-4 w-4" />}
        </div>
        <div className="text-left">
          <div className="text-xs font-bold text-foreground">
            {active ? "Mi camino activo" : "Mi camino"}
          </div>
          <div className="text-[10.5px] text-muted-foreground">{subtitle}</div>
        </div>
      </div>
      <Switch checked={active} onCheckedChange={(v) => onToggle(v)} />
    </HapticButton>
  );
}