import { useEffect, useState } from "react";
import {
  Compass,
  Trophy,
  Swords,
  TrendingUp,
  Sparkles,
  ChevronRight,
  X,
  ClipboardList,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TOUR_STORAGE_KEY = "aceplay-welcome-tour-seen-v3";

interface TourStep {
  icon: typeof Trophy;
  title: string;
  description: string;
  accent: string;
}

// Tour alineado a la app ACTUAL (Arena · gamificada · 5 destinos): nada de
// "club como centro" ni reservas/clases (módulos dormidos). Las 3 capas:
// habilidad (nivel) · enganche (liga/XP/racha) · premio (Fichas).
const STEPS: TourStep[] = [
  {
    icon: Sparkles,
    title: "Tennis, gamified",
    description: "Tu nivel, tu liga y tus desafíos en un solo lugar. Lo esencial en 5 segundos.",
    accent: "from-action to-[hsl(var(--action-deep))]",
  },
  {
    icon: TrendingUp,
    title: "Tu nivel sube jugando",
    description:
      "Tu rating evoluciona con cada partido que el rival confirma. Subes de categoría compitiendo — nunca se compra.",
    accent: "from-action to-[hsl(var(--action-deep))]",
  },
  {
    icon: Swords,
    title: "Desafía y sube en la escalerilla",
    description:
      "Con el botón Desafío retas a jugadores de tu nivel. Ganas y subes posiciones; el resultado cuenta cuando tu rival lo confirma.",
    accent: "from-action to-[hsl(var(--action-deep))]",
  },
  {
    icon: Trophy,
    title: "Liga, XP y Fichas",
    description:
      "Cada semana compites en tu Liga y ganas XP. Los hitos te dan Fichas que canjeas por beneficios en la Tienda — son capas distintas: tu rating no se compra con Fichas.",
    accent: "from-action to-[hsl(var(--action-deep))]",
  },
  {
    icon: Compass,
    title: "Descubre toda la red",
    description:
      "Inscríbete en eventos abiertos de cualquier club desde Descubrir, sin hacerte socio. Tu rating es portable: viaja contigo por toda la red.",
    accent: "from-action to-[hsl(var(--action-deep))]",
  },
];

// Pantalla puente al cuestionario de nivel — no cuenta como paso del tour.
const BRIDGE = {
  icon: ClipboardList,
  title: "Antes de empezar…",
  description: "7 preguntas rápidas para estimar tu nivel inicial. Toma menos de un minuto.",
  accent: "from-action to-[hsl(var(--action-deep))]",
};

export const WelcomeTour = ({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  // step en [0..STEPS.length-1] = pasos normales; STEPS.length = pantalla puente
  const [step, setStep] = useState(0);
  const total = STEPS.length;
  const isBridge = step === total;

  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  const handleClose = () => {
    try {
      localStorage.setItem(TOUR_STORAGE_KEY, "1");
    } catch {
      // ignore
    }
    onOpenChange(false);
  };

  const next = () => {
    if (step < total) setStep((s) => s + 1);
    else handleClose();
  };

  const current = isBridge ? BRIDGE : STEPS[step];
  const Icon = current.icon;

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(v) : handleClose())}>
      <DialogContent className="max-w-sm gap-0 overflow-hidden rounded-3xl border-0 p-0 shadow-elevated [&>button]:hidden">
        <DialogTitle className="sr-only">{current.title}</DialogTitle>
        <DialogDescription className="sr-only">{current.description}</DialogDescription>

        <button
          type="button"
          onClick={handleClose}
          aria-label="Cerrar tour"
          className="absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-background/80 text-muted-foreground backdrop-blur transition-smooth hover:bg-background hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header con icono */}
        <div
          key={step}
          className={cn(
            "relative flex h-36 items-center justify-center overflow-hidden bg-gradient-to-br",
            current.accent,
          )}
        >
          <div className="absolute -left-6 -top-6 h-24 w-24 rounded-full bg-white/15 blur-xl animate-pulse" />
          <div
            className="absolute -bottom-8 -right-4 h-28 w-28 rounded-full bg-white/10 blur-2xl animate-pulse"
            style={{ animationDelay: "0.4s" }}
          />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.18),transparent_60%)]" />

          <div
            key={`icon-${step}`}
            className="relative flex h-18 w-18 items-center justify-center rounded-3xl bg-white/20 p-4 backdrop-blur-md shadow-clay animate-scale-in"
          >
            <Icon className="h-9 w-9 text-white drop-shadow-md" strokeWidth={2} />
          </div>
        </div>

        {/* Contenido */}
        <div className="space-y-5 bg-card px-6 pb-6 pt-5">
          <div key={`text-${step}`} className="space-y-2 animate-fade-in text-center">
            {!isBridge && (
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">
                {step + 1} / {total}
              </p>
            )}
            <h3 className="font-display text-xl font-semibold leading-tight text-foreground">
              {current.title}
            </h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {current.description}
            </p>
          </div>

          {/* Indicadores: ocultos en pantalla puente */}
          {!isBridge && (
            <div className="flex items-center justify-center gap-1.5">
              {STEPS.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setStep(i)}
                  aria-label={`Ir al paso ${i + 1}`}
                  className={cn(
                    "h-1.5 rounded-full transition-smooth",
                    i === step
                      ? "w-6 bg-primary"
                      : i < step
                        ? "w-1.5 bg-primary/60"
                        : "w-1.5 bg-muted",
                  )}
                />
              ))}
            </div>
          )}

          {/* Acciones */}
          <div className="flex items-center gap-2">
            {!isBridge && (
              <Button variant="ghost" size="sm" onClick={handleClose} className="flex-1">
                Saltar
              </Button>
            )}
            <Button
              variant="clay"
              size="default"
              onClick={next}
              className={cn("gap-1", isBridge ? "w-full" : "flex-1")}
            >
              {isBridge ? "Calcular mi nivel" : "Siguiente"}
              {!isBridge && <ChevronRight className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export const hasSeenWelcomeTour = (): boolean => {
  try {
    return localStorage.getItem(TOUR_STORAGE_KEY) === "1";
  } catch {
    return true;
  }
};

export const resetWelcomeTour = () => {
  try {
    localStorage.removeItem(TOUR_STORAGE_KEY);
  } catch {
    // ignore
  }
};
