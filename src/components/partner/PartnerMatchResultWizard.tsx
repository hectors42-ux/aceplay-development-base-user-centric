import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Loader2, Trophy, UserX, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  ScoreboardEditor,
  editorToSetScores,
  emptyScoreboardValue,
  validateScoreboardValue,
  type ScoreboardEditorValue,
  type Outcome,
} from "@/components/match/ScoreboardEditor";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  invitationId: string;
  meId: string;
  meName: string;
  meAvatarUrl?: string | null;
  opponentId: string;
  opponentName: string;
  opponentAvatarUrl?: string | null;
  onSubmitted?: () => void;
}

const initials = (n: string) =>
  n
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase() || "?";

type Step = 1 | 2 | 3;

/**
 * Wizard de 3 pasos para cargar el resultado de un partner match.
 *  1) Tipo de cierre (Score / W.O. / Retiro)
 *  2) Marcador (ScoreboardEditor) o selección de ganador (W.O./retiro)
 *  3) Resumen + confirmación
 */
export const PartnerMatchResultWizard = ({
  open,
  onOpenChange,
  invitationId,
  meId,
  meName,
  meAvatarUrl,
  opponentId,
  opponentName,
  opponentAvatarUrl,
  onSubmitted,
}: Props) => {
  const [step, setStep] = useState<Step>(1);
  const [value, setValue] = useState<ScoreboardEditorValue>(emptyScoreboardValue());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setStep(1);
      setValue(emptyScoreboardValue());
      setSubmitting(false);
    }
  }, [open]);

  const validation = useMemo(
    () => validateScoreboardValue(value, meId, opponentId),
    [value, meId, opponentId],
  );
  const canSubmit = validation.ok;

  const setOutcome = (next: Outcome) => {
    setValue((v) => ({
      ...v,
      outcome: next,
      winnerId: next === "score" ? null : v.winnerId,
    }));
  };

  const handleSubmit = async () => {
    if (!canSubmit) {
      toast.error(validation.message);
      return;
    }
    setSubmitting(true);
    const isWalkover = value.outcome === "walkover";
    const isRetired = value.outcome === "retired";
    const sets = editorToSetScores(value);
    const { error } = await supabase.rpc("submit_partner_match_result", {
      _invitation_id: invitationId,
      _winner_user_id: value.winnerId,
      _score: (isWalkover ? null : sets) as never,
      _walkover: isWalkover,
      _retired: isRetired,
    });
    setSubmitting(false);
    if (error) {
      toast.error("No se pudo cargar el resultado", { description: error.message });
      return;
    }
    toast.success("Resultado propuesto", {
      description: `${opponentName} debe confirmar para aplicarlo al rating.`,
    });
    onOpenChange(false);
    onSubmitted?.();
  };

  const winnerName =
    value.winnerId === meId ? meName : value.winnerId === opponentId ? opponentName : null;

  const outcomeLabel =
    value.outcome === "walkover"
      ? "W.O."
      : value.outcome === "retired"
        ? "Retiro"
        : "Score";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="h-[100dvh] max-h-[100dvh] w-screen max-w-full gap-0 rounded-none border-0 p-0 sm:h-auto sm:max-h-[90dvh] sm:max-w-lg sm:rounded-2xl"
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
            <button
              type="button"
              onClick={() => (step === 1 ? onOpenChange(false) : setStep((step - 1) as Step))}
              className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label={step === 1 ? "Cerrar" : "Volver"}
            >
              {step === 1 ? <X className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />}
            </button>
            <div className="flex flex-1 flex-col items-center">
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Resultado · paso {step} de 3
              </span>
              <div className="mt-1 flex gap-1">
                {[1, 2, 3].map((s) => (
                  <span
                    key={s}
                    className={cn(
                      "h-1 w-6 rounded-full",
                      s <= step ? "bg-primary" : "bg-muted",
                    )}
                  />
                ))}
              </div>
            </div>
            <div className="w-7" aria-hidden />
          </header>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-4 py-5">
            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <h2 className="font-display text-xl font-semibold">¿Cómo terminó el partido?</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {meName} vs {opponentName}
                  </p>
                </div>
                <div className="grid gap-2">
                  {(
                    [
                      {
                        id: "score" as Outcome,
                        icon: Trophy,
                        title: "Se jugó con marcador",
                        desc: "Carga los sets en el siguiente paso.",
                      },
                      {
                        id: "walkover" as Outcome,
                        icon: UserX,
                        title: "Walkover (W.O.)",
                        desc: "Alguien no se presentó. El otro avanza.",
                      },
                      {
                        id: "retired" as Outcome,
                        icon: X,
                        title: "Retiro durante el partido",
                        desc: "Uno se retiró por lesión u otro motivo.",
                      },
                    ]
                  ).map((opt) => {
                    const Icon = opt.icon;
                    const active = value.outcome === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setOutcome(opt.id)}
                        className={cn(
                          "flex items-start gap-3 rounded-2xl border p-3 text-left transition",
                          active
                            ? "border-primary bg-primary/10"
                            : "border-border bg-card hover:border-primary/40",
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                            active ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold">{opt.title}</p>
                          <p className="text-[11px] text-muted-foreground">{opt.desc}</p>
                        </div>
                        {active && <Check className="mt-1 h-4 w-4 text-primary" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <h2 className="font-display text-xl font-semibold">
                    {value.outcome === "score" ? "Carga el marcador" : "¿Quién ganó?"}
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {value.outcome === "score"
                      ? "Ingresa los sets jugados. El ganador se detecta automáticamente."
                      : value.outcome === "walkover"
                        ? "Selecciona quién avanza por W.O."
                        : "Selecciona quién se llevó el partido."}
                  </p>
                </div>
                <ScoreboardEditor
                  me={{ id: meId, name: meName, avatarUrl: meAvatarUrl }}
                  opponent={{ id: opponentId, name: opponentName, avatarUrl: opponentAvatarUrl }}
                  value={value}
                  onChange={setValue}
                />
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <div>
                  <h2 className="font-display text-xl font-semibold">Confirma y envía</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {opponentName} recibirá una notificación para confirmar el resultado. El
                    rating se aplica recién cuando ambos están de acuerdo.
                  </p>
                </div>

                <div className="rounded-2xl border border-border bg-card p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Tipo
                  </p>
                  <p className="text-sm font-semibold">{outcomeLabel}</p>

                  {value.outcome === "score" && (
                    <>
                      <p className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Marcador
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {editorToSetScores(value).map((s, i) => (
                          <span
                            key={i}
                            className="rounded-md bg-muted px-2 py-0.5 text-xs font-bold tabular-nums"
                          >
                            {s.a}-{s.b}
                            {typeof s.tb === "number" ? `(${s.tb})` : ""}
                          </span>
                        ))}
                      </div>
                    </>
                  )}

                  <p className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Ganador
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarImage
                        src={(value.winnerId === meId ? meAvatarUrl : opponentAvatarUrl) ?? undefined}
                      />
                      <AvatarFallback className="text-[10px]">
                        {initials(winnerName ?? "?")}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-semibold">{winnerName ?? "—"}</span>
                  </div>
                </div>

                {!canSubmit && (
                  <p
                    role="alert"
                    className="rounded-xl border border-destructive/40 bg-destructive/10 p-2.5 text-[11px] font-medium text-destructive"
                  >
                    {validation.message}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <footer className="border-t border-border bg-card px-4 py-3">
            {step < 3 ? (
              <Button
                variant="clay"
                size="lg"
                className="w-full"
                disabled={step === 2 && !canSubmit}
                onClick={() => setStep((step + 1) as Step)}
              >
                Continuar <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                variant="clay"
                size="lg"
                className="w-full"
                disabled={!canSubmit || submitting}
                onClick={handleSubmit}
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Enviar resultado
              </Button>
            )}
          </footer>
        </div>
      </DialogContent>
    </Dialog>
  );
};
