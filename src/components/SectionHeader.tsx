import type { ReactNode } from "react";

export function SectionHeader({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3 px-1">
      <div>
        {eyebrow && (
          <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-muted-foreground">
            {eyebrow}
          </p>
        )}
        <h2 className="font-display text-xl text-foreground">{title}</h2>
      </div>
      {action}
    </div>
  );
}