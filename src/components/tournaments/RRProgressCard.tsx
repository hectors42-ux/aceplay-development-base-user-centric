import { CalendarClock, Trophy, Flame, Percent } from "lucide-react";
import { useRRProgress } from "@/hooks/useRoundRobinExtras";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// Avance del Round Robin + cuenta regresiva al corte + zonas del reglamento
// (premio top-N / asado últimos-N). SOLO LECTURA. Vista jugador y organizador.
export function RRProgressCard({ categoryId, className }: { categoryId: string; className?: string }) {
  const { data: p, isLoading } = useRRProgress(categoryId);
  if (isLoading) return <Skeleton className={cn("h-24 w-full rounded-2xl", className)} />;
  if (!p) return null;

  // Días al corte (sin Date.now en SSR; aquí es cliente).
  let daysLeft: number | null = null;
  if (p.closes_at) {
    const ms = new Date(p.closes_at).getTime() - Date.now();
    daysLeft = Math.max(0, Math.ceil(ms / 86_400_000));
  }

  return (
    <section className={cn("rounded-2xl border border-border bg-card p-4 shadow-card", className)}>
      <div className="mb-3 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          <Percent className="h-3.5 w-3.5" /> Avance del torneo
        </p>
        {p.closes_at && (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-action">
            <CalendarClock className="h-3.5 w-3.5" />
            {daysLeft != null ? `${daysLeft} días al corte` : "—"}
          </span>
        )}
      </div>

      {/* Barra de cumplimiento */}
      <div className="mb-1 flex items-baseline justify-between">
        <span className="font-display text-2xl font-black text-foreground tabular-nums">{p.pct}%</span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {p.played} de {p.possible} partidos · faltan {p.remaining}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-skill" style={{ width: `${Math.min(100, p.pct)}%` }} />
      </div>

      {/* Zonas del reglamento */}
      {(p.prize_top > 0 || p.asado_bottom > 0) && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
          {p.prize_top > 0 && (
            <span className="inline-flex items-center gap-1"><Trophy className="h-3 w-3 text-fichas" /> Top {p.prize_top}: premio</span>
          )}
          {p.asado_bottom > 0 && (
            <span className="inline-flex items-center gap-1"><Flame className="h-3 w-3 text-action" /> Últimos {p.asado_bottom}: asado</span>
          )}
          {p.closes_at && (
            <span className="ml-auto">Cierra {new Date(p.closes_at).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" })}</span>
          )}
        </div>
      )}
    </section>
  );
}
