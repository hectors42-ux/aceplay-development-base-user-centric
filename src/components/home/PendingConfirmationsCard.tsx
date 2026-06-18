import { useNavigate } from "react-router-dom";
import { Trophy, ChevronRight, Clock } from "lucide-react";
import { usePendingConfirmations } from "@/hooks/usePendingConfirmations";
import { cn } from "@/lib/utils";

function formatScore(score: unknown): string | null {
  if (!score || typeof score !== "object") return null;
  const sets = score as Array<{ a?: number; b?: number }>;
  if (!Array.isArray(sets) || sets.length === 0) return null;
  return sets.map((s) => `${s.a ?? 0}-${s.b ?? 0}`).join(" · ");
}

export function PendingConfirmationsCard() {
  const navigate = useNavigate();
  const { matches, loading } = usePendingConfirmations();

  if (loading || matches.length === 0) return null;

  return (
    <section className="px-5" aria-label="Resultados pendientes de confirmar">
      <div className="rounded-2xl border-2 border-primary/40 bg-primary/5 p-4 motion-safe:shadow-[0_0_24px_hsl(var(--primary)/0.15)]">
        <header className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-primary" aria-hidden />
          <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-primary">
            Confirmar resultado{matches.length > 1 ? "s" : ""}
          </p>
        </header>
        <ul className="mt-3 space-y-2">
          {matches.map((m) => {
            const score = formatScore(m.score);
            const catLabel = m.category?.label ?? "Partido";
            const tName = m.category?.tournament?.name ?? "Torneo";
            return (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/resultado-pendiente/${m.id}`)}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-xl border bg-card px-3 py-2.5 text-left transition-smooth",
                    "hover:border-primary/60 hover:bg-primary/5",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{tName}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {catLabel}
                      {score ? <> · <span className="font-mono">{score}</span></> : null}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                      <Clock className="h-3 w-3" aria-hidden /> Pendiente de tu confirmación
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}