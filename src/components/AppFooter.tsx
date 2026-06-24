import { cn } from "@/lib/utils";

// Footer de marca (sin referencia al club): arco "The Serve" + wordmark Cormorant
// (Ace roman · Play italic) + tagline "Tennis, gamified" + año + derechos.
export function AppFooter({ className }: { className?: string }) {
  const year = new Date().getFullYear();
  return (
    <footer className={cn("flex flex-col items-center gap-1 px-5 pt-2 text-center", className)}>
      <span className="flex items-center gap-1.5">
        <img src="/images/mark-arc-primary.png" alt="" aria-hidden className="h-4 w-auto object-contain" />
        <span className="font-cormorant text-base font-semibold leading-none tracking-tight">
          <span className="text-foreground">Ace</span>
          <span className="italic text-action">Play</span>
        </span>
      </span>
      <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
        Tennis, gamified · {year}
      </p>
      <p className="text-[10px] text-muted-foreground/70">Todos los derechos reservados.</p>
    </footer>
  );
}
