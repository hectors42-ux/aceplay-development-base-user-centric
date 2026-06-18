import { type ReactNode } from "react";
import { HapticButton } from "@/components/feedback";

export type AlertSeverity = "destructive" | "warning" | "primary";

interface Props {
  severity: AlertSeverity;
  icon: ReactNode;
  title: string;
  subtitle: string;
  actionLabel: string;
  onAction: () => void;
}

const TONE: Record<AlertSeverity, { border: string; bg: string; chip: string; btn: string }> = {
  destructive: {
    border: "border-l-destructive",
    bg: "bg-destructive/5",
    chip: "text-destructive",
    btn: "bg-destructive text-destructive-foreground",
  },
  warning: {
    border: "border-l-amber-500",
    bg: "bg-amber-500/5",
    chip: "text-amber-600",
    btn: "bg-amber-500 text-white",
  },
  primary: {
    border: "border-l-primary",
    bg: "bg-primary/5",
    chip: "text-primary",
    btn: "bg-primary text-primary-foreground",
  },
};

export function AlertCard({ severity, icon, title, subtitle, actionLabel, onAction }: Props) {
  const tone = TONE[severity];
  const haptic = severity === "destructive" ? "warning" : "medium";
  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border border-border border-l-4 ${tone.border} ${tone.bg} p-3`}
    >
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-card shadow-sm ${tone.chip}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold leading-tight">{title}</div>
        <div className="text-xs leading-snug text-muted-foreground">{subtitle}</div>
      </div>
      <HapticButton
        level={haptic}
        onClick={onAction}
        className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide ${tone.btn} transition-transform active:scale-95`}
      >
        {actionLabel}
      </HapticButton>
    </div>
  );
}