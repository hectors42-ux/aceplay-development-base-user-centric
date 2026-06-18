import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Variante del Hero por defecto cuando no hay próxima reserva,
 * torneo activo, MOTW propio ni sugerencia disponible.
 */
export const HeroIdle = () => (
  <>
    <div className="space-y-1 text-white">
      <h1 className="font-display text-4xl font-semibold leading-[1.05] tracking-tight md:text-5xl">
        La Pirámide
        <br />
        te espera.
      </h1>
      <p className="max-w-[28ch] text-sm text-white/85">
        Sube posiciones desafiando a un socio de tu nivel.
      </p>
    </div>
    <Link to="/ranking?tab=piramide" className="w-fit">
      <Button variant="clay" size="lg" aria-label="Ver la Pirámide del club">
        Ver Pirámide
        <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
      </Button>
    </Link>
  </>
);
