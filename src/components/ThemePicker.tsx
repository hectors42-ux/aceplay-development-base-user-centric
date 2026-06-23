import { Check, Monitor, Moon, Sun } from "lucide-react";
import { THEMES, PICKER_THEME_IDS, ThemeMode, type ThemeId } from "@/lib/themes";
import { SEASONAL_BLURB, type SurfaceTheme } from "@/lib/seasonal-theme";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";

const MODES: { id: ThemeMode; label: string; Icon: typeof Sun }[] = [
  { id: "light", label: "Claro", Icon: Sun },
  { id: "dark", label: "Oscuro", Icon: Moon },
  { id: "system", label: "Auto", Icon: Monitor },
];

export const ThemePicker = () => {
  const { theme, effectiveTheme, mode, setTheme, setMode } = useTheme();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-display text-base font-semibold text-foreground">Apariencia</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Elige tu superficie. Tu look persiste en tu perfil.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {PICKER_THEME_IDS.map((id) => {
            const t = THEMES[id as ThemeId];
            const sel = id === theme;
            const isSeasonal = id === "seasonal";
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTheme(id)}
                aria-pressed={sel}
                className={cn(
                  "relative flex flex-col gap-2 rounded-2xl border-2 p-4 text-left transition-smooth focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  sel
                    ? "border-primary bg-accent/40 shadow-card"
                    : "border-border bg-card hover:border-primary/40",
                )}
              >
                {sel && (
                  <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                  </span>
                )}
                <div className="flex gap-1">
                  {t.swatches.map((c) => (
                    <span
                      key={c}
                      className="h-6 w-6 rounded-full ring-1 ring-black/10"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <div>
                  <p className="font-display text-base font-semibold text-foreground">{t.label}</p>
                  <p className="text-[11px] text-muted-foreground">{t.sublabel}</p>
                  {isSeasonal && (
                    <p className="mt-1 text-[11px] font-medium text-primary">
                      Ahora: {THEMES[effectiveTheme]?.label ?? "Arena"} · {SEASONAL_BLURB[effectiveTheme as SurfaceTheme] ?? ""}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <h3 className="font-display text-base font-semibold text-foreground">Modo</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Funciona dentro del tema elegido.
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {MODES.map(({ id, label, Icon }) => {
            const sel = mode === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setMode(id)}
                aria-pressed={sel}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 rounded-xl border-2 py-3 text-xs font-medium transition-smooth focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  sel
                    ? "border-primary bg-accent/40 text-primary"
                    : "border-border bg-card text-muted-foreground hover:border-primary/40",
                )}
              >
                <Icon className="h-4 w-4" strokeWidth={2} />
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
