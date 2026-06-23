import { cn } from "@/lib/utils";

export interface SponsorLockupProps {
  sponsor: string;
  prefix?: string;
  logoUrl?: string;
  className?: string;
}

// Sponsor lockup = tratamiento NEUTRO (no es un rol de capa; no compite con
// skill/fichas/action). Trademark gate: uso interno/piloto.
export function SponsorLockup({ sponsor, prefix = "Presentado por", logoUrl, className }: SponsorLockupProps) {
  return (
    <div className={cn("inline-flex items-center gap-2 text-muted-foreground", className)}>
      <span className="text-[11px]">{prefix}</span>
      {logoUrl ? (
        <img src={logoUrl} alt={sponsor} className="h-4 w-auto opacity-90" />
      ) : (
        <span className="font-display text-sm font-semibold text-foreground">{sponsor}</span>
      )}
    </div>
  );
}
