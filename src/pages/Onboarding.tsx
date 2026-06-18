import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  Trophy,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import {
  computeInitialLevel,
  formatLevel,
  getLevelBand,
  type OnboardingAnswers,
  type RatingSport,
} from "@/lib/rating-utils";
import { hasCachedRatingOnboarding, markRatingOnboardingDone } from "@/lib/onboarding";
import { cn } from "@/lib/utils";
import { WelcomeTour, hasSeenWelcomeTour } from "@/components/onboarding/WelcomeTour";

interface Option<K extends keyof OnboardingAnswers> {
  value: OnboardingAnswers[K];
  label: string;
  hint?: string;
}

interface Step<K extends keyof OnboardingAnswers> {
  key: K;
  title: string;
  subtitle: string;
  options: Option<K>[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const STEPS: Step<any>[] = [
  {
    key: "experience",
    title: "¿Hace cuánto practicas tu deporte principal?",
    subtitle: "Cuéntanos tu trayectoria con la raqueta",
    options: [
      { value: "none", label: "Nunca he jugado" },
      { value: "less_1", label: "Menos de 1 año" },
      { value: "1_3", label: "1 a 3 años" },
      { value: "3_5", label: "3 a 5 años" },
      { value: "5_10", label: "5 a 10 años" },
      { value: "more_10", label: "Más de 10 años" },
    ],
  },
  {
    key: "frequency",
    title: "¿Con qué frecuencia juegas?",
    subtitle: "Tu ritmo actual de práctica",
    options: [
      { value: "rare", label: "Ocasional", hint: "Menos de 1 vez al mes" },
      { value: "monthly", label: "Mensual", hint: "1-2 veces al mes" },
      { value: "weekly", label: "Semanal", hint: "1 vez por semana" },
      { value: "multi_week", label: "Varias veces por semana", hint: "2-4 veces" },
      { value: "daily", label: "Casi diario", hint: "5+ veces por semana" },
    ],
  },
  {
    key: "background",
    title: "¿Cuál es tu formación?",
    subtitle: "Tu nivel de entrenamiento más serio",
    options: [
      { value: "none", label: "Autodidacta" },
      { value: "club_classes", label: "Clases en club" },
      { value: "amateur_tournaments", label: "Torneos amateur" },
      { value: "federated", label: "Federado / liga" },
      { value: "ex_competitor", label: "Ex-competidor profesional" },
    ],
  },
  {
    key: "rallies",
    title: "¿Cuánto sostienes un peloteo?",
    subtitle: "Golpes consecutivos sin fallar",
    options: [
      { value: "few", label: "Menos de 10 golpes" },
      { value: "10_20", label: "10 a 20 golpes" },
      { value: "20_50", label: "20 a 50 golpes" },
      { value: "50_plus", label: "50 o más" },
    ],
  },
  {
    key: "serve",
    title: "¿Cómo es tu saque?",
    subtitle: "Sé honesto, esto define mucho tu nivel",
    options: [
      { value: "none", label: "Aún no domino el saque" },
      { value: "in_court", label: "Pongo la pelota en cancha" },
      { value: "directed", label: "Coloco direcciones (T, abierto)" },
      { value: "powerful", label: "Saque potente con efectos" },
    ],
  },
  {
    key: "selfRating",
    title: "¿Cómo te autoevalúas?",
    subtitle: "Tu percepción honesta del nivel",
    options: [
      { value: "beginner", label: "Principiante", hint: "Estoy aprendiendo" },
      { value: "low_inter", label: "Intermedio bajo", hint: "Sé jugar pero me falta" },
      { value: "inter", label: "Intermedio", hint: "Juego bien con pares" },
      { value: "high_inter", label: "Intermedio alto", hint: "Compito con táctica" },
      { value: "advanced", label: "Avanzado", hint: "Gano la mayoría de mis matches" },
      { value: "competitive", label: "Competitivo", hint: "Federado / nivel torneo" },
    ],
  },
  {
    key: "lastTournament",
    title: "¿Tu último torneo?",
    subtitle: "El nivel competitivo más reciente",
    options: [
      { value: "never", label: "Nunca he competido" },
      { value: "internal", label: "Interno del club" },
      { value: "local", label: "Local / municipal" },
      { value: "regional", label: "Regional" },
      { value: "national", label: "Nacional o superior" },
    ],
  },
];

type SportFlag = { tenis: boolean; padel: boolean };
type PadelPosition = "drive" | "reves" | "ambos";

const Onboarding = () => {
  const navigate = useNavigate();
  const { user, refreshProfile } = useAuth();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  // Si la URL trae ?sport=tenis|padel, entramos en "modo single sport":
  // se omite el selector inicial y solo se crea el rating del deporte pedido.
  const forcedSportParam = searchParams.get("sport");
  const forcedSport: "tenis" | "padel" | null =
    forcedSportParam === "padel" ? "padel" : forcedSportParam === "tenis" ? "tenis" : null;
  // Pasos virtuales:
  //   -1 → selector de deportes
  //   0..STEPS.length-1 → cuestionario de nivel
  //   STEPS.length → (solo si padel está activo) posición de pádel
  const [step, setStep] = useState(forcedSport ? 0 : -1);
  const [sports, setSports] = useState<SportFlag>(
    forcedSport
      ? { tenis: forcedSport === "tenis", padel: forcedSport === "padel" }
      : { tenis: true, padel: false },
  );
  const [padelPosition, setPadelPosition] = useState<PadelPosition | null>(null);
  const [answers, setAnswers] = useState<Partial<OnboardingAnswers>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ level: number; reliability: number } | null>(null);
  const [tourOpen, setTourOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (!hasSeenWelcomeTour()) {
      const t = setTimeout(() => setTourOpen(true), 350);
      return () => clearTimeout(t);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    // Cuando venimos con ?sport=... ignoramos el caché: el usuario quiere
    // completar el cuestionario para un deporte adicional.
    if (forcedSport) return;
    if (hasCachedRatingOnboarding(user.id)) {
      navigate("/", { replace: true });
    }
  }, [navigate, user, forcedSport]);

  const hasAnySport = sports.tenis || sports.padel;
  const totalQuizSteps = STEPS.length;
  const showPadelStep = sports.padel;
  const lastStepIndex = showPadelStep ? totalQuizSteps : totalQuizSteps - 1;
  const isSportPick = step === -1;
  const isPadelStep = showPadelStep && step === totalQuizSteps;
  const currentStep = !isSportPick && !isPadelStep ? STEPS[step] : null;
  const currentValue = currentStep
    ? answers[currentStep.key as keyof OnboardingAnswers]
    : undefined;

  const progress = useMemo(() => {
    if (isSportPick) return 0;
    const answered = Object.keys(answers).length + (isPadelStep && padelPosition ? 1 : 0);
    const total = totalQuizSteps + (showPadelStep ? 1 : 0);
    return Math.round((answered / total) * 100);
  }, [answers, isSportPick, isPadelStep, padelPosition, showPadelStep, totalQuizSteps]);

  const handleSelect = (value: string) => {
    if (!currentStep) return;
    setAnswers((prev) => ({ ...prev, [currentStep.key]: value }));
  };

  const canAdvance = () => {
    if (isSportPick) return hasAnySport;
    if (isPadelStep) return !!padelPosition;
    return !!currentValue;
  };

  const handleNext = async () => {
    if (!canAdvance()) return;

    if (step < lastStepIndex) {
      setStep(step + 1);
      return;
    }

    if (!user) {
      toast({ title: "Debes iniciar sesión", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    const computed = computeInitialLevel(answers as OnboardingAnswers);

    const sportsToCreate: RatingSport[] = [];
    if (sports.tenis) sportsToCreate.push("tenis_singles");
    if (sports.padel) sportsToCreate.push("padel");

    try {
      for (const s of sportsToCreate) {
        const { error } = await supabase.rpc("complete_rating_onboarding", {
          _sport: s,
          _initial_level: computed.level,
          _initial_reliability: computed.reliability,
        });
        if (error) throw error;
      }

      // Persistir preferencia de deporte y datos de pádel en el perfil.
      // En modo "single sport" (segundo pase) NO sobrescribimos el deporte
      // preferido del usuario; solo guardamos padel_position si corresponde.
      const preferred = sports.padel && !sports.tenis ? "padel" : "tenis";
      const profileUpdate: {
        preferred_sport?: string;
        padel_position?: string;
      } = forcedSport ? {} : { preferred_sport: preferred };
      if (sports.padel && padelPosition) {
        profileUpdate.padel_position = padelPosition;
      }
      if (Object.keys(profileUpdate).length > 0) {
        await supabase.from("profiles").update(profileUpdate).eq("user_id", user.id);
      }

      // Dejamos como deporte activo el que acaba de completar el cuestionario.
      // - flujo normal: el preferido elegido.
      // - segundo pase (forcedSport): el deporte recién agregado.
      const activeAfter = forcedSport ?? preferred;
      try {
        window.localStorage.setItem("aceplay:active-sport", activeAfter);
      } catch {
        /* ignore */
      }

      markRatingOnboardingDone(user.id);
      setDone(computed);
      // Invalida toda la cache dependiente del rating/onboarding para que
      // Home y Perfil muestren el nivel recién creado al instante (sin
      // tener que esperar a que expire el staleTime del prefetch post-login).
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["profile-summary", user.id] }),
        queryClient.invalidateQueries({ queryKey: ["my-rating", user.id] }),
        queryClient.invalidateQueries({ queryKey: ["club-ranking"] }),
        queryClient.invalidateQueries({ queryKey: ["home-stats", user.id] }),
      ]);
      void refreshProfile();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      toast({ title: "No pudimos guardar tu nivel", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    if (step > -1) setStep(step - 1);
  };

  // ---------- Render: pantalla final ----------
  if (done) {
    const band = getLevelBand(done.level);
    return (
      <div className="min-h-screen bg-gradient-warm">
        <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-clay shadow-clay">
            <Trophy className="h-10 w-10 text-primary-foreground" strokeWidth={2.2} />
          </div>
          <h1 className="mt-6 font-display text-2xl font-semibold">¡Tu nivel inicial está listo!</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Es solo una estimación. Jugando matches competitivos lo afinaremos.
          </p>

          <div className="mt-8 w-full rounded-3xl border border-border bg-card p-6 shadow-card">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Tu nivel
            </p>
            <p className="mt-2 font-display text-6xl font-bold tracking-tight text-foreground">
              {formatLevel(done.level)}
            </p>
            <p className={cn("mt-2 text-sm font-semibold", band.color)}>{band.label}</p>
            <p className="mt-2 text-xs text-muted-foreground">{band.description}</p>

            {sports.tenis && sports.padel && (
              <p className="mt-3 text-[11px] text-muted-foreground">
                Aplicado a Tenis y Pádel. Podrás afinar cada deporte por separado a medida que juegues.
              </p>
            )}

            <div className="mt-5 rounded-2xl bg-muted/60 p-3 text-left">
              <div className="mb-1 flex items-center justify-between text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                <span>Fiabilidad</span>
                <span>{done.reliability}%</span>
              </div>
              <Progress value={done.reliability} className="h-2" />
              <p className="mt-2 text-[11px] text-muted-foreground">
                Subirá conforme juegues partidos competitivos validados.
              </p>
            </div>
          </div>

          <Button
            variant="clay"
            size="lg"
            className="mt-6 w-full"
            onClick={() =>
              navigate("/", {
                replace: true,
                state: { onboardingCompleted: true },
              })
            }
          >
            <Sparkles className="h-4 w-4" /> Empezar a jugar
          </Button>
        </div>
      </div>
    );
  }

  // ---------- Render: cuestionario ----------
  const totalSteps = totalQuizSteps + (showPadelStep ? 1 : 0);
  const headerStepLabel = isSportPick
    ? "Tus deportes"
    : isPadelStep
      ? `Paso ${totalSteps} de ${totalSteps}`
      : `Pregunta ${step + 1} de ${totalSteps}`;

  return (
    <div className="min-h-screen bg-gradient-warm">
      <WelcomeTour open={tourOpen} onOpenChange={setTourOpen} />
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-5 py-6">
        {/* Header */}
        <div className="mb-4 flex items-center gap-3">
          <button
            type="button"
            onClick={handleBack}
            disabled={step === -1}
            className="flex h-9 w-9 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground transition-smooth hover:text-foreground disabled:opacity-40"
            aria-label="Anterior"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Tu nivel inicial
            </p>
            <p className="font-display text-base font-semibold">{headerStepLabel}</p>
          </div>
        </div>
        <Progress value={progress} className="mb-6 h-1.5" />

        {/* Contenido */}
        <div className="flex-1">
          {isSportPick && (
            <>
              <h2 className="font-display text-2xl font-semibold leading-tight">
                ¿Qué deportes practicas?
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Selecciona al menos uno. Podrás activar el otro más adelante desde tu perfil.
              </p>
              <div className="mt-6 space-y-2.5">
                {(["tenis", "padel"] as const).map((s) => {
                  const active = sports[s];
                  const label = s === "tenis" ? "Tenis" : "Pádel";
                  const hint =
                    s === "tenis"
                      ? "Singles y dobles"
                      : "Siempre se juega en pareja";
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSports((prev) => ({ ...prev, [s]: !prev[s] }))}
                      className={cn(
                        "flex w-full items-center justify-between gap-3 rounded-2xl border bg-card p-4 text-left transition-smooth",
                        active
                          ? "border-primary bg-primary/5 shadow-clay"
                          : "border-border hover:border-primary/40 hover:-translate-y-0.5",
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground">{label}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
                      </div>
                      {active && <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />}
                    </button>
                  );
                })}
              </div>
              {!hasAnySport && (
                <p className="mt-3 text-xs text-destructive">
                  Selecciona al menos un deporte para continuar.
                </p>
              )}
            </>
          )}

          {isPadelStep && (
            <>
              <h2 className="font-display text-2xl font-semibold leading-tight">
                En pádel, ¿dónde juegas?
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Tu lado preferido en la pareja. Sirve para sugerirte compañeros compatibles.
              </p>
              <div className="mt-6 space-y-2.5">
                {([
                  { value: "drive", label: "Lado del drive", hint: "Derecha (diestros)" },
                  { value: "reves", label: "Lado del revés", hint: "Izquierda" },
                  { value: "ambos", label: "Indistinto", hint: "Me adapto" },
                ] as const).map((opt) => {
                  const active = padelPosition === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setPadelPosition(opt.value)}
                      className={cn(
                        "flex w-full items-center justify-between gap-3 rounded-2xl border bg-card p-4 text-left transition-smooth",
                        active
                          ? "border-primary bg-primary/5 shadow-clay"
                          : "border-border hover:border-primary/40 hover:-translate-y-0.5",
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground">{opt.label}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{opt.hint}</p>
                      </div>
                      {active && <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {currentStep && (
            <>
              <h2 className="font-display text-2xl font-semibold leading-tight">
                {currentStep.title}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">{currentStep.subtitle}</p>

              <div className="mt-6 space-y-2.5">
                {currentStep.options.map((opt: Option<keyof OnboardingAnswers>) => {
                  const active = currentValue === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleSelect(opt.value)}
                      className={cn(
                        "flex w-full items-center justify-between gap-3 rounded-2xl border bg-card p-4 text-left transition-smooth",
                        active
                          ? "border-primary bg-primary/5 shadow-clay"
                          : "border-border hover:border-primary/40 hover:-translate-y-0.5",
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground">{opt.label}</p>
                        {opt.hint && (
                          <p className="mt-0.5 text-xs text-muted-foreground">{opt.hint}</p>
                        )}
                      </div>
                      {active && <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="mt-6">
          <Button
            variant="clay"
            size="lg"
            className="w-full"
            disabled={!canAdvance() || submitting}
            onClick={handleNext}
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                {step === lastStepIndex ? "Calcular mi nivel" : "Siguiente"}
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
          <p className="mt-3 text-center text-[11px] text-muted-foreground">
            Sé honesto: un nivel inflado lleva a partidos desbalanceados.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
