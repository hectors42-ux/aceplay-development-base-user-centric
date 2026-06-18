import type { PlayerStep } from "@/lib/rules-markdown";

interface HowItWorksProps {
  steps: PlayerStep[];
  accentColor?: string;
}

export const HowItWorks = ({ steps, accentColor }: HowItWorksProps) => {
  if (steps.length === 0) return null;
  const color = accentColor ?? "hsl(var(--primary))";
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.32em] text-muted-foreground">
        Cómo funciona
      </p>
      <ol className="space-y-3">
        {steps.map((s, idx) => (
          <li key={idx} className="flex gap-3">
            <span
              className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-display text-sm font-semibold text-white"
              style={{ background: color }}
            >
              {idx + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-tight">{s.title}</p>
              {s.body && (
                <p className="mt-0.5 text-xs text-muted-foreground">{s.body}</p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
};