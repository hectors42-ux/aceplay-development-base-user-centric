import { Check, Info, Sparkles } from "lucide-react";
import { HapticButton } from "@/components/feedback/HapticButton";
import { Badge } from "@/components/ui/badge";
import {
  PRESETS_BY_KEY,
  TOURNAMENT_PRESETS,
  type PresetKey,
  type TournamentSport,
} from "@/lib/tournament-presets";
import { FORMAT_ICON_BY_PRESET } from "./FormatIcons";

interface Props {
  value: PresetKey;
  onChange: (key: PresetKey) => void;
  sport: TournamentSport;
  suggestedKey?: PresetKey;
}

export function FormatPicker({ value, onChange, sport, suggestedKey }: Props) {
  return (
    <div className="space-y-3">
      {suggestedKey && PRESETS_BY_KEY[suggestedKey] && (
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          Sugerido del evento:{" "}
          <strong className="text-foreground">
            {PRESETS_BY_KEY[suggestedKey].label}
          </strong>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {TOURNAMENT_PRESETS.map((p) => {
          const Icon = FORMAT_ICON_BY_PRESET[p.key];
          const on = value === p.key;
          const disabled = !p.available && p.key !== "personalizado";
          const isSuggested = suggestedKey === p.key;
          return (
            <HapticButton
              key={p.key}
              level="light"
              type="button"
              disabled={disabled}
              onClick={() => !disabled && onChange(p.key)}
              className={`relative rounded-2xl bg-card p-3.5 text-left transition-all duration-200 ${
                on
                  ? "border-2 border-primary shadow-clay -translate-y-0.5"
                  : "border border-border hover:border-primary/40"
              } ${disabled ? "cursor-not-allowed opacity-55" : ""}`}
            >
              {on && (
                <div className="pop-in absolute right-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="h-3 w-3" />
                </div>
              )}
              {!on && isSuggested && !disabled && (
                <Badge
                  variant="secondary"
                  className="absolute right-2 top-2 text-[9px] uppercase tracking-wider"
                >
                  Sugerido
                </Badge>
              )}
              <div
                className={`flex h-[70px] items-center justify-center rounded-xl p-2 transition-colors ${
                  on ? "bg-primary/5 text-primary" : "bg-muted text-muted-foreground"
                }`}
              >
                <Icon />
              </div>
              <div className="mt-2.5 font-serif text-[15px] font-semibold leading-tight">
                {p.label}
              </div>
              <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                {p.helper}
              </div>
              {!p.available && p.key !== "personalizado" && (
                <Badge
                  variant="secondary"
                  className="mt-2 text-[9px] uppercase tracking-wider"
                >
                  Próximamente
                </Badge>
              )}
            </HapticButton>
          );
        })}
      </div>

      {sport === "padel" && (
        <div className="flex items-center gap-3 rounded-2xl border border-success/30 bg-success/10 p-3.5">
          <div className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-success text-success-foreground">
            <Info className="h-4 w-4" />
          </div>
          <div className="text-[12px] leading-snug">
            <b>El pádel se juega en dobles</b> — el modo singles no aplica para esta
            disciplina.
          </div>
        </div>
      )}
    </div>
  );
}