import { Fragment } from "react";
import { Check } from "lucide-react";

interface Props {
  active: number;
  steps?: string[];
}

export const DEFAULT_WIZARD_STEPS = ["Disciplina", "Formato", "Reglas", "Listo"];

export function Stepper({ active, steps = DEFAULT_WIZARD_STEPS }: Props) {
  return (
    <div className="flex items-center gap-1.5 px-1 py-3">
      {steps.map((label, i) => {
        const done = i < active;
        const cur = i === active;
        return (
          <Fragment key={i}>
            <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-extrabold transition-colors ${
                  done
                    ? "bg-success text-success-foreground pop-in"
                    : cur
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              <div
                className={`truncate text-[10px] font-bold uppercase tracking-widest ${
                  cur ? "text-primary" : done ? "text-success" : "text-muted-foreground"
                }`}
              >
                {label}
              </div>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`mb-3.5 h-0.5 flex-[.8] rounded-full transition-colors duration-300 ${
                  done ? "bg-success" : "bg-muted"
                }`}
              />
            )}
          </Fragment>
        );
      })}
    </div>
  );
}