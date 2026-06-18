import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ComingSoon({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Sparkles className="h-9 w-9" />
      </div>
      <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-muted-foreground">
        Próximamente
      </p>
      <h1 className="mt-2 font-display text-3xl text-foreground">{title}</h1>
      <p className="mt-3 max-w-sm text-sm text-muted-foreground">{copy}</p>
      <Button asChild variant="outline" className="mt-6">
        <Link to="/">Volver al inicio</Link>
      </Button>
    </div>
  );
}