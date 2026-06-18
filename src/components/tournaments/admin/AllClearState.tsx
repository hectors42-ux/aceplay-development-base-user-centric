import { Check } from "lucide-react";
import { RingAnimated } from "@/components/feedback";

interface Props {
  matchesPlayed: number;
  matchesTotal: number;
  confirmedRegistrations: number;
  totalRegistrations: number;
}

export function AllClearState({
  matchesPlayed,
  matchesTotal,
  confirmedRegistrations,
  totalRegistrations,
}: Props) {
  const confirmedPct =
    totalRegistrations > 0 ? Math.round((confirmedRegistrations / totalRegistrations) * 100) : 0;
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-border bg-gradient-to-br from-emerald-500/10 to-card p-5">
        <div className="flex items-center gap-5">
          <div className="relative shrink-0" style={{ width: 140, height: 140 }}>
            <RingAnimated pct={100} size={140} stroke={12} track="hsl(var(--success) / 0.2)" />
            <div className="absolute inset-0 flex items-center justify-center text-emerald-600">
              <Check className="h-14 w-14" strokeWidth={2.2} />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-emerald-600">
              Todo en orden
            </div>
            <div className="mt-1 font-display text-2xl font-semibold leading-tight">
              El torneo se<br />
              <em className="italic text-emerald-600">maneja solo</em> 🎾
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              No hay desafíos pendientes,<br />ni resultados sin confirmar.
            </p>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Partidos jugados" value={`${matchesPlayed}/${matchesTotal}`} />
        <Stat label="Confirmados" value={`${confirmedPct}%`} />
        <Stat label="Inscritos" value={`${confirmedRegistrations}`} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-display text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}