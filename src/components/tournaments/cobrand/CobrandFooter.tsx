import { Flag } from "./Flag";
import { cn } from "@/lib/utils";
import type { TournamentCobrand } from "@/hooks/useTournamentCobrand";

interface Props {
  cobrand: Pick<TournamentCobrand, "display_name" | "flag_country"> | null | undefined;
  className?: string;
}

/** Watermark para share cards: `[bandera] aceplay × stade français` */
export function CobrandFooter({ cobrand, className }: Props) {
  if (!cobrand) return null;
  return (
    <div
      className={cn(
        "flex items-center justify-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.32em] text-white/70",
        className,
      )}
    >
      <Flag countryCode={cobrand.flag_country} size={12} />
      <span>aceplay × {cobrand.display_name.toLowerCase()}</span>
    </div>
  );
}