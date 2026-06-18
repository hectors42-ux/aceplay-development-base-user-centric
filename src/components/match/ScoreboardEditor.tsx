import { useEffect, useMemo, useRef } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { formatLevel } from "@/lib/rating-utils";
import type { SetScore } from "@/lib/tournament-utils";
import {
  DEFAULT_PROFILE,
  validateScore as validateProfileScore,
  type ScoringProfile,
} from "@/lib/scoring-profile";

export type Outcome = "score" | "walkover" | "retired";

export interface ScoreboardPlayer {
  id: string;
  name: string;
  avatarUrl?: string | null;
  level?: number | null;
}

/** Un set editable: [puntos del lado "me", puntos del lado "opponent", tie-break perdedor opcional]. */
export type EditableSet = {
  me: number | null;
  opp: number | null;
  tb?: number | null;
};

export interface ScoreboardEditorValue {
  outcome: Outcome;
  sets: EditableSet[];
  winnerId: string | null;
}

interface Props {
  me: ScoreboardPlayer;
  opponent: ScoreboardPlayer;
  value: ScoreboardEditorValue;
  onChange: (v: ScoreboardEditorValue) => void;
  /** Texto opcional bajo el cuadro (ej. "Tu rival deberá confirmarlo"). */
  helperText?: string;
  className?: string;
  /**
   * Perfil de scoring de la categoría (PRD 8). Cuando se pasa, manda sobre el
   * conteo de filas, el render del set final (súper-TB) y la validación.
   * Si falta, se usa el comportamiento legacy.
   */
  profile?: ScoringProfile;
}

const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase() || "?";

const MIN_SETS = 2;
const MAX_SETS = 3;

const isSuperTbIndex = (idx: number, profile?: ScoringProfile) =>
  !!profile && idx === profile.sets - 1 && profile.final_set === "super_tb10";

/** Construye sets vacíos por defecto. */
export const emptyScoreboardValue = (): ScoreboardEditorValue => ({
  outcome: "score",
  sets: [
    { me: null, opp: null },
    { me: null, opp: null },
  ],
  winnerId: null,
});

/** Convierte el value del editor al formato SetScore[] que esperan las RPC. */
export function editorToSetScores(
  value: ScoreboardEditorValue,
  profile?: ScoringProfile,
): SetScore[] {
  return value.sets
    .filter((s) => s.me !== null && s.opp !== null)
    .map<SetScore>((s, i) => {
      const base: SetScore = { a: s.me as number, b: s.opp as number };
      if (typeof s.tb === "number" && Number.isFinite(s.tb)) base.tb = s.tb;
      // Sólo etiquetamos `kind` cuando hay profile (compat con consumidores legacy).
      if (profile) {
        base.kind = isSuperTbIndex(i, profile) ? "super_tb" : "set";
      }
      return base;
    });
}

/** Devuelve el id del ganador inferido a partir de los sets o null si empate/incompleto. */
export function inferEditorWinner(
  value: ScoreboardEditorValue,
  meId: string,
  opponentId: string,
): string | null {
  let meSets = 0;
  let oppSets = 0;
  for (const s of value.sets) {
    if (s.me === null || s.opp === null) continue;
    if (s.me > s.opp) meSets++;
    else if (s.opp > s.me) oppSets++;
  }
  if (meSets === oppSets) return null;
  return meSets > oppSets ? meId : opponentId;
}

/**
 * Devuelve true si el set tiene un marcador 7-6 o 6-7 y por lo tanto debe
 * mostrarse el input de tie-break (puntos del perdedor del TB, ej. 7-6(5)).
 */
export function setHasTieBreakSlot(s: EditableSet): boolean {
  if (s.me === null || s.opp === null) return false;
  return (s.me === 7 && s.opp === 6) || (s.me === 6 && s.opp === 7);
}


export type ScoreboardValidation =
  | { ok: true; message?: undefined; code?: undefined }
  | {
      ok: false;
      code:
        | "missing_winner"
        | "min_sets"
        | "incomplete_set"
        | "tied_set"
        | "winner_mismatch"
        | "no_sets_for_score"
        | "profile";
      message: string;
    };

/**
 * Valida el value del editor según el outcome. Útil para bloquear el envío
 * a la RPC y mostrar un mensaje consistente en los 3 diálogos.
 *
 * Reglas:
 *  - score: mínimo 2 sets cargados completos, sin empates por set y el ganador
 *    debe coincidir con quien ganó más sets.
 *  - walkover/retired: requiere ganador seleccionado manualmente.
 */
export function validateScoreboardValue(
  value: ScoreboardEditorValue,
  meId: string,
  opponentId: string,
  profile?: ScoringProfile,
): ScoreboardValidation {
  if (value.outcome === "walkover" || value.outcome === "retired") {
    if (!value.winnerId) {
      return {
        ok: false,
        code: "missing_winner",
        message:
          value.outcome === "walkover"
            ? "Selecciona quién avanza por W.O."
            : "Selecciona quién ganó por retiro del rival.",
      };
    }
    return { ok: true };
  }

  // outcome === "score"
  const complete = value.sets.filter((s) => s.me !== null && s.opp !== null);
  const partial = value.sets.filter(
    (s) => (s.me !== null) !== (s.opp !== null), // exactamente uno cargado
  );

  if (complete.length === 0) {
    return { ok: false, code: "no_sets_for_score", message: "Carga al menos un set jugado." };
  }
  if (partial.length > 0) {
    return {
      ok: false,
      code: "incomplete_set",
      message: "Hay sets con un solo marcador cargado. Completa ambos o elimínalos.",
    };
  }
  // Sólo exigimos mínimo 2 sets cuando NO hay profile (legacy bo3).
  if (!profile && complete.length < 2) {
    return {
      ok: false,
      code: "min_sets",
      message: "Un partido válido requiere al menos 2 sets.",
    };
  }
  for (const s of complete) {
    if (s.me === s.opp) {
      return {
        ok: false,
        code: "tied_set",
        message: "Un set no puede terminar empatado. Revisa los marcadores.",
      };
    }
  }
  const inferred = inferEditorWinner(value, meId, opponentId);
  if (!inferred) {
    return {
      ok: false,
      code: "tied_set",
      message: "Los sets no definen un ganador claro. Revisa los marcadores.",
    };
  }
  if (!value.winnerId) {
    return { ok: false, code: "missing_winner", message: "Falta el ganador del partido." };
  }
  if (value.winnerId !== inferred) {
    return {
      ok: false,
      code: "winner_mismatch",
      message: "El ganador seleccionado no coincide con quien ganó más sets.",
    };
  }

  // Validación contra el perfil (PRD 8).
  if (profile) {
    const sets = editorToSetScores(value, profile);
    const res = validateProfileScore(sets, profile);
    if (res.ok === false) {
      return { ok: false, code: "profile", message: res.error };
    }
  }
  return { ok: true };
}

const clamp = (n: number, min = 0, max = 99) => Math.max(min, Math.min(max, n));

/**
 * Editor visual estilo cuadro de tenis: dos filas con jugadores y debajo
 * una grilla de hasta 3 sets con inputs numéricos. Inspirado en
 * `RecentMatchesCarousel` para mantener consistencia visual con el historial.
 */
export const ScoreboardEditor = ({
  me,
  opponent,
  value,
  onChange,
  helperText,
  className,
  profile,
}: Props) => {
  const isWalkover = value.outcome === "walkover";

  // Cuando hay profile, sincronizar el número de filas con profile.sets.
  useEffect(() => {
    if (!profile) return;
    if (value.sets.length === profile.sets) return;
    const next = [...value.sets];
    while (next.length < profile.sets) next.push({ me: null, opp: null });
    while (next.length > profile.sets) next.pop();
    onChange({ ...value, sets: next });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.sets]);

  // Inferencia automática del ganador en modo "score".
  const inferred = useMemo(
    () => (value.outcome === "score" ? inferEditorWinner(value, me.id, opponent.id) : null),
    [value, me.id, opponent.id],
  );

  // Si el outcome es "score" y hay un ganador inferido distinto al actual,
  // sincronizamos sin pisar selección manual en walkover/retired.
  const lastInferredRef = useRef<string | null>(null);
  useEffect(() => {
    if (value.outcome !== "score") return;
    if (inferred && inferred !== value.winnerId && inferred !== lastInferredRef.current) {
      lastInferredRef.current = inferred;
      onChange({ ...value, winnerId: inferred });
    }
    if (!inferred) lastInferredRef.current = null;
  }, [inferred, value, onChange]);

  const setCount = value.sets.length;

  const updateSet = (idx: number, patch: Partial<EditableSet>) => {
    const next = value.sets.map((s, i) => (i === idx ? { ...s, ...patch } : s));
    onChange({ ...value, sets: next });
  };

  const addSet = () => {
    if (profile) return;
    if (setCount >= MAX_SETS) return;
    onChange({ ...value, sets: [...value.sets, { me: null, opp: null }] });
  };

  const removeSet = (idx: number) => {
    if (profile) return;
    if (setCount <= MIN_SETS) return;
    onChange({ ...value, sets: value.sets.filter((_, i) => i !== idx) });
  };

  const setOutcome = (next: Outcome) => {
    onChange({ ...value, outcome: next, winnerId: next === "score" ? null : value.winnerId });
  };

  const renderSetInput = (
    side: "me" | "opp",
    idx: number,
    sVal: number | null,
    isWinningSide: boolean,
  ) => {
    return (
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={2}
        value={sVal === null ? "" : String(sVal)}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^0-9]/g, "");
          const next = raw === "" ? null : clamp(parseInt(raw, 10));
          updateSet(idx, side === "me" ? { me: next } : { opp: next });
        }}
        placeholder="–"
        aria-label={`Set ${idx + 1} ${side === "me" ? me.name : opponent.name}`}
        className={cn(
          "flex h-9 w-full min-w-0 items-center justify-center rounded-md border text-center font-bold tabular-nums leading-none outline-none transition",
          "text-sm sm:h-10 sm:text-base",
          "focus:ring-2 focus:ring-primary/40 focus:border-primary",
          isWinningSide
            ? "border-foreground bg-foreground text-background"
            : "border-border bg-background text-foreground",
        )}
      />
    );
  };

  return (
    <div className={cn("space-y-3", className)}>
      {/* Selector de tipo de resultado */}
      <div className="flex flex-wrap gap-1.5">
        {(["score", "walkover", "retired"] as Outcome[]).map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => setOutcome(o)}
            className={cn(
              "rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide transition",
              value.outcome === o
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-background text-muted-foreground hover:bg-muted/50",
            )}
          >
            {o === "score" ? "Score" : o === "walkover" ? "W.O." : "Retiro"}
          </button>
        ))}
      </div>

      {/* Cuadro tipo scoreboard */}
      <div className="rounded-2xl border border-border bg-card p-3 shadow-sm">
        {/* Header fila: jugadores + sets */}
        <div
          className="grid items-center gap-2"
          style={{
            gridTemplateColumns: `minmax(0,1fr) repeat(${isWalkover ? 0 : setCount}, minmax(2.25rem, 1fr))${
              isWalkover ? "" : " auto"
            }`,
          }}
        >
          {/* Encabezado vacío sobre nombres + headers de set */}
          <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Jugador
          </div>
          {!isWalkover &&
            value.sets.map((_, i) => (
              <div
                key={`h-${i}`}
                className="text-center text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
              >
                {isSuperTbIndex(i, profile) ? "STB10" : `S${i + 1}`}
              </div>
            ))}
          {!isWalkover && <div className="w-6" aria-hidden />}

          {/* Fila YO */}
          <div className="flex min-w-0 items-center gap-2">
            <Avatar className="h-7 w-7 shrink-0">
              <AvatarImage src={me.avatarUrl ?? undefined} />
              <AvatarFallback className="text-[10px]">{initials(me.name)}</AvatarFallback>
            </Avatar>
            <span className="min-w-0 flex-1 truncate text-xs font-semibold">{me.name}</span>
            {me.level != null && (
              <span className="shrink-0 rounded-md bg-success/15 px-1 py-0.5 text-[10px] font-bold leading-none text-success">
                {formatLevel(me.level)}
              </span>
            )}
          </div>
          {!isWalkover &&
            value.sets.map((s, i) => {
              const win = s.me !== null && s.opp !== null && s.me > s.opp;
              return <div key={`m-${i}`}>{renderSetInput("me", i, s.me, win)}</div>;
            })}
          {!isWalkover && <div className="w-6" aria-hidden />}

          {/* Fila RIVAL */}
          <div className="flex min-w-0 items-center gap-2">
            <Avatar className="h-7 w-7 shrink-0">
              <AvatarImage src={opponent.avatarUrl ?? undefined} />
              <AvatarFallback className="text-[10px]">{initials(opponent.name)}</AvatarFallback>
            </Avatar>
            <span className="min-w-0 flex-1 truncate text-xs font-semibold">{opponent.name}</span>
            {opponent.level != null && (
              <span className="shrink-0 rounded-md bg-muted px-1 py-0.5 text-[10px] font-bold leading-none text-muted-foreground">
                {formatLevel(opponent.level)}
              </span>
            )}
          </div>
          {!isWalkover &&
            value.sets.map((s, i) => {
              const win = s.me !== null && s.opp !== null && s.opp > s.me;
              return <div key={`o-${i}`}>{renderSetInput("opp", i, s.opp, win)}</div>;
            })}
          {!isWalkover && !profile && (
            <div className="flex flex-col items-center justify-center">
              {setCount > MIN_SETS && (
                <button
                  type="button"
                  onClick={() => removeSet(setCount - 1)}
                  aria-label="Quitar último set"
                  className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
          {!isWalkover && profile && <div aria-hidden />}

          {/* Fila TIE-BREAK: solo se muestra si algún set 7-6/6-7 amerita.
              Por cada set, si aplica, muestra un input pequeño para los puntos
              del perdedor del tie-break (ej: 5 en un 7-6(5)). */}
          {!isWalkover && value.sets.some(setHasTieBreakSlot) && (
            <>
              <div className="text-right text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                TB
              </div>
              {value.sets.map((s, i) => {
                if (!setHasTieBreakSlot(s)) {
                  return <div key={`tb-${i}`} aria-hidden />;
                }
                return (
                  <div key={`tb-${i}`}>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={2}
                      value={s.tb == null ? "" : String(s.tb)}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/[^0-9]/g, "");
                        const next = raw === "" ? null : clamp(parseInt(raw, 10));
                        updateSet(i, { tb: next });
                      }}
                      placeholder="–"
                      aria-label={`Tie-break set ${i + 1}`}
                      title="Puntos del perdedor en el tie-break"
                      className="flex h-6 w-full min-w-0 items-center justify-center rounded border border-dashed border-border bg-background text-center text-[11px] font-semibold tabular-nums leading-none text-muted-foreground outline-none transition focus:ring-2 focus:ring-primary/40 focus:border-primary"
                    />
                  </div>
                );
              })}
              <div aria-hidden />
            </>
          )}
        </div>

        {!isWalkover && !profile && setCount < MAX_SETS && (
          <div className="mt-3 flex justify-center">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addSet}
              className="h-7 gap-1 rounded-full px-3 text-[11px]"
            >
              <Plus className="h-3 w-3" /> Agregar set {setCount + 1}
            </Button>
          </div>
        )}
      </div>

      {/* Selector de ganador (solo si no se infiere o si es walkover/retired) */}
      {(value.outcome !== "score" || !inferred) && (
        <div>
          <Label className="mb-1.5 block text-xs">
            {value.outcome === "walkover" ? "¿Quién avanza por W.O.?" : "¿Quién ganó?"}
          </Label>
          <RadioGroup
            value={value.winnerId ?? ""}
            onValueChange={(v) => onChange({ ...value, winnerId: v })}
            className="grid grid-cols-2 gap-2"
          >
            <Label className="flex cursor-pointer items-center gap-2 rounded-2xl border border-border p-2 text-xs has-[input:checked]:border-primary has-[input:checked]:bg-primary/10">
              <RadioGroupItem value={me.id} />
              <span className="min-w-0 truncate">{me.name}</span>
            </Label>
            <Label className="flex cursor-pointer items-center gap-2 rounded-2xl border border-border p-2 text-xs has-[input:checked]:border-primary has-[input:checked]:bg-primary/10">
              <RadioGroupItem value={opponent.id} />
              <span className="min-w-0 truncate">{opponent.name}</span>
            </Label>
          </RadioGroup>
        </div>
      )}

      {value.outcome === "score" && inferred && (
        <p className="text-[11px] text-muted-foreground">
          Ganador detectado:{" "}
          <span className="font-semibold text-foreground">
            {inferred === me.id ? me.name : opponent.name}
          </span>
        </p>
      )}

      {(() => {
        // Mostrar feedback de validación solo si el usuario ya empezó a interactuar
        // (algún set tiene al menos un input o cambió el outcome).
        const touched =
          value.outcome !== "score" ||
          value.sets.some((s) => s.me !== null || s.opp !== null);
        if (!touched) return null;
        const v = validateScoreboardValue(value, me.id, opponent.id, profile);
        if (v.ok) return null;
        const message = v.message;
        return (
          <p
            role="alert"
            className="rounded-xl border border-destructive/40 bg-destructive/10 p-2.5 text-[11px] font-medium text-destructive"
          >
            {message}
          </p>
        );
      })()}

      {helperText && (
        <p className="rounded-xl border border-border bg-muted/30 p-2.5 text-[11px] text-muted-foreground">
          {helperText}
        </p>
      )}
    </div>
  );
};
