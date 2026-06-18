import { Link } from "react-router-dom";
import { Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ExternalBookingCTA } from "@/components/booking/ExternalBookingCTA";

interface Rival {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  level: number | null;
  compat_score: number | null;
  reasons: string[] | null;
}

const initials = (a?: string | null, b?: string | null) =>
  `${a?.[0] ?? ""}${b?.[0] ?? ""}`.toUpperCase() || "?";

/**
 * Variante del Hero: sugerencia personalizada de rival cuando no hay torneo
 * activo ni MOTW que involucre al usuario.
 */
export const HeroSuggestedRival = ({ rival }: { rival: Rival }) => {
  const name = `${rival.first_name ?? ""} ${rival.last_name ?? ""}`.trim() || "Socio";
  const lastInitial = (rival.last_name ?? "").charAt(0);
  const display = rival.first_name ? `${rival.first_name} ${lastInitial}.` : "este rival";
  const reason = rival.reasons?.[0] ?? (rival.level != null ? `Nivel ${rival.level}` : "Compatible contigo");

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-accent/95 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-accent-foreground backdrop-blur-md">
          <Sparkles className="h-3 w-3" strokeWidth={2.6} />
          Sugerido para ti
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Avatar className="h-14 w-14 ring-2 ring-white/40">
          <AvatarImage src={rival.avatar_url ?? undefined} alt={name} />
          <AvatarFallback>{initials(rival.first_name, rival.last_name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 space-y-0.5 text-white">
          <p className="text-[11px] uppercase tracking-wider text-white/70">Reta a</p>
          <h1 className="font-display text-3xl font-semibold leading-[1.05] tracking-tight md:text-4xl">
            {display}
          </h1>
          <p className="text-xs text-white/85">
            {reason}
            {rival.compat_score != null && ` · Compatibilidad ${rival.compat_score}%`}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Link to="/ranking?tab=partner" className="w-fit">
          <Button variant="clay" size="lg" aria-label={`Enviar desafío a ${name}`}>
            Enviar desafío
            <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
          </Button>
        </Link>
        <ExternalBookingCTA
          source="hero"
          matchKind="suggestion"
          refId={rival.user_id}
          variant="outline"
          size="default"
          className="border-white/40 bg-white/10 text-white hover:bg-white/20"
        />
      </div>
    </>
  );
};
