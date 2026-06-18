import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Flag } from "./Flag";
import type { TournamentCobrand } from "@/hooks/useTournamentCobrand";

interface Props {
  cobrand: TournamentCobrand;
  children: ReactNode;
  className?: string;
}

/**
 * Contenedor del hero cobranded. Aplica el gradient del sponsor y deja
 * el contenido (back/share buttons, título, stats, CTA) al consumidor.
 */
export function CobrandHero({ cobrand, children, className }: Props) {
  const gradient = cobrand.gradient_css || cobrand.primary_hex || "#14213D";

  return (
    <header
      className={cn("relative overflow-hidden text-white", className)}
      style={{ background: gradient }}
    >
      <div className="pointer-events-none absolute -right-8 -top-10 h-44 w-44 rounded-full bg-white/10" />
      <div className="pointer-events-none absolute -bottom-5 -left-3 h-24 w-24 rounded-full bg-white/5" />
      <div className="relative mx-auto max-w-md px-5 pb-6 pt-5">
        {(cobrand.lockup_text || cobrand.flag_country) && (
          <div className="mb-2 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.32em] text-white/85">
            <Flag countryCode={cobrand.flag_country} size={14} />
            <span>
              {cobrand.lockup_text ?? `ACEPLAY × ${cobrand.display_name.toUpperCase()}`}
            </span>
          </div>
        )}
        {cobrand.eyebrow_text && (
          <p className="mb-1 font-display text-xs italic text-white/80">
            {cobrand.eyebrow_text}
          </p>
        )}
        {children}
      </div>
    </header>
  );
}