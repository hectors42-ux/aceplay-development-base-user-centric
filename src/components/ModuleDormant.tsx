import { Link } from "react-router-dom";
import { Moon, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BottomNav } from "@/components/BottomNav";
import { MODULES, type ModuleKey } from "@/config/modules";

/**
 * Estado limpio para un módulo DORMIDO (reservas, clases).
 *
 * Se muestra cuando alguien llega por ruta directa a una pantalla cuyo módulo
 * está apagado en src/config/modules.ts. Nunca muestra un error ni datos
 * falsos: solo comunica que la sección aún no está disponible y devuelve al
 * inicio. La página "real" del módulo sigue en el repo (preservada) para
 * reaprovecharla al activarlo.
 */
export const ModuleDormant = ({ module }: { module: ModuleKey }) => {
  const cfg = MODULES[module];
  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="mx-auto flex max-w-md flex-col items-center px-5 pt-24 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-muted">
          <Moon className="h-6 w-6 text-muted-foreground" strokeWidth={1.8} />
        </div>
        <h1 className="mt-4 font-display text-xl font-semibold">
          {cfg.label} no está disponible todavía
        </h1>
        <p className="mt-2 max-w-xs text-sm text-muted-foreground">{cfg.dormantCopy}</p>
        <Button asChild variant="clay" className="mt-6">
          <Link to="/">
            <ArrowLeft className="h-4 w-4" /> Volver al inicio
          </Link>
        </Button>
      </div>
      <BottomNav />
    </div>
  );
};

export default ModuleDormant;
