import { Plus } from "lucide-react";
import { HapticButton } from "@/components/feedback";

interface Props {
  label: string;
  onClick: () => void;
  className?: string;
}

export function StandingsFAB({ label, onClick, className = "" }: Props) {
  return (
    <div className={`sticky bottom-4 z-10 mt-3 ${className}`}>
      <HapticButton
        level="medium"
        onClick={onClick}
        className="shimmer-host inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/30 transition-transform active:scale-[0.98]"
      >
        <Plus className="h-4 w-4" />
        <span>{label}</span>
      </HapticButton>
    </div>
  );
}