import { Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface ComingSoonCardProps {
  label: string;
  reason?: string;
}

export function ComingSoonCard({ label, reason = "Disponible próximamente" }: ComingSoonCardProps) {
  return (
    <Card className="rounded-2xl border-dashed border-border/60 bg-muted/30">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Lock className="h-3.5 w-3.5 text-muted-foreground/60" />
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">{reason}</TooltipContent>
          </Tooltip>
        </div>
        <p className="mt-2 font-display text-lg text-muted-foreground/80">Próximamente</p>
      </CardContent>
    </Card>
  );
}
