import { cn } from "@/lib/utils";
import { Flag } from "./Flag";
import type { TournamentCobrand } from "@/hooks/useTournamentCobrand";

interface Props {
  cobrand:
    | Pick<TournamentCobrand, "display_name" | "flag_country" | "lockup_text" | "primary_hex">
    | null
    | undefined;
  variant?: "pill" | "lockup";
  className?: string;
}

export function CobrandBadge({ cobrand, variant = "pill", className }: Props) {
  if (!cobrand) return null;

  if (variant === "lockup") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.32em] text-white/85",
          className,
        )}
      >
        <Flag countryCode={cobrand.flag_country} size={14} />
        {cobrand.lockup_text ?? `ACEPLAY × ${cobrand.display_name.toUpperCase()}`}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border bg-card/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        className,
      )}
      style={
        cobrand.primary_hex
          ? { borderColor: `${cobrand.primary_hex}40`, color: cobrand.primary_hex }
          : undefined
      }
    >
      <Flag countryCode={cobrand.flag_country} size={12} />
      {cobrand.display_name}
    </span>
  );
}