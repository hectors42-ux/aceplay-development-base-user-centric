import { useEffect, useState } from "react";

/**
 * Animación "tabla congelada" del cierre de torneo. Overlay full-screen,
 * fade no-podio + sweep clay + elevación del podio. Auto-cierra a los ~900ms
 * y llama onComplete. Respeta prefers-reduced-motion (sin animar).
 */
interface Props {
  podiumNames: { gold?: string; silver?: string; bronze?: string };
  onComplete: () => void;
}

export function FrozenTableAnimation({ podiumNames, onComplete }: Props) {
  const [phase, setPhase] = useState<0 | 1 | 2 | 3>(0);

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      const t = window.setTimeout(onComplete, 200);
      return () => window.clearTimeout(t);
    }
    const t1 = window.setTimeout(() => setPhase(1), 50);
    const t2 = window.setTimeout(() => setPhase(2), 350);
    const t3 = window.setTimeout(() => setPhase(3), 550);
    const tEnd = window.setTimeout(onComplete, 1100);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
      window.clearTimeout(tEnd);
    };
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[hsl(var(--ink))]/80 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md rounded-3xl border border-white/10 bg-card p-6 shadow-2xl">
        <p className="text-center font-mono text-[10px] uppercase tracking-[0.32em] text-muted-foreground">
          Congelando resultados
        </p>
        <ol className="mt-4 space-y-2">
          {(["gold", "silver", "bronze"] as const).map((slot, idx) => {
            const elevated = phase >= 3;
            const name = podiumNames[slot];
            return (
              <li
                key={slot}
                className={`flex items-center gap-3 rounded-2xl border border-border px-4 py-3 transition-all duration-300 ${
                  elevated ? "-translate-y-1 shadow-lg shadow-primary/20" : ""
                } ${phase >= 1 && !name ? "opacity-40" : "opacity-100"}`}
              >
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full font-bold text-white ${
                    idx === 0 ? "bg-amber-400" : idx === 1 ? "bg-slate-400" : "bg-amber-700"
                  }`}
                >
                  {idx + 1}
                </span>
                <span className="flex-1 font-display text-sm font-semibold">{name ?? "—"}</span>
              </li>
            );
          })}
        </ol>
        <div className="mt-4 h-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all"
            style={{
              width: phase >= 2 ? "100%" : "0%",
              transitionDuration: phase >= 2 ? "200ms" : "0ms",
              background: "var(--gradient-clay)",
            }}
          />
        </div>
      </div>
    </div>
  );
}