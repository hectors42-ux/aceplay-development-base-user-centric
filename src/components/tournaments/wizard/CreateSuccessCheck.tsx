import { Check } from "lucide-react";

export function CreateSuccessCheck({ label = "¡Cuadro creado!" }: { label?: string }) {
  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 rounded-lg bg-background/95 backdrop-blur-sm">
      <div className="pop-in glow flex h-20 w-20 items-center justify-center rounded-full bg-success text-success-foreground shadow-clay">
        <Check className="h-10 w-10" strokeWidth={3} />
      </div>
      <div className="font-serif text-xl text-foreground">{label}</div>
    </div>
  );
}