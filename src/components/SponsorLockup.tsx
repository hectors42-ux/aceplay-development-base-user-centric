import { Sparkles } from "lucide-react";
import { useSponsor, type SponsorScope } from "@/hooks/useSponsor";
import { cn } from "@/lib/utils";

interface Props {
  scope: SponsorScope;
  refId?: string | null;
  className?: string;
}

/**
 * Slot de presencia de marca para insertar en cada superficie. Muestra el
 * placement ganador (resolver determinístico). Si no hay placement activo, no
 * renderiza nada. Piloto interno — sin reskin fino aún.
 */
export const SponsorLockup = ({ scope, refId, className }: Props) => {
  const { sponsor } = useSponsor(scope, refId);
  if (!sponsor) return null;
  return (
    <div
      className={cn("mx-5 flex items-center gap-2 rounded-2xl border border-border bg-card/60 px-3 py-2", className)}
      aria-label={`Presentado por ${sponsor.brand_name}`}
    >
      {sponsor.logo_url ? (
        <img src={sponsor.logo_url} alt="" className="h-5 w-5 rounded object-contain" />
      ) : (
        <Sparkles className="h-4 w-4 text-muted-foreground" />
      )}
      <span className="text-[11px] text-muted-foreground">
        Presentado por <span className="font-semibold text-foreground">{sponsor.brand_name}</span>
      </span>
    </div>
  );
};

export default SponsorLockup;
