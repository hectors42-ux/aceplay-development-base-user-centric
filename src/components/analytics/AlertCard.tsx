import { AlertTriangle, ArrowRight, Lightbulb, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

export type AlertVariant = "critical" | "opportunity" | "info";

interface AlertCardProps {
  variant: AlertVariant;
  title: string;
  body: string;
  actionUrl?: string | null;
  actionLabel?: string;
}

const ICONS: Record<AlertVariant, typeof AlertTriangle> = {
  critical: AlertTriangle,
  opportunity: Lightbulb,
  info: Sparkles,
};

export function AlertCard({ variant, title, body, actionUrl, actionLabel = "Ver detalle" }: AlertCardProps) {
  const Icon = ICONS[variant];
  return (
    <Card
      className={cn(
        "rounded-2xl border transition-shadow hover:shadow-md",
        variant === "critical" && "border-destructive/30 bg-destructive/5",
        variant === "opportunity" && "border-success/30 bg-success/5",
        variant === "info" && "border-primary/30 bg-primary/5",
      )}
    >
      <CardContent className="flex items-start gap-3 p-4">
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
            variant === "critical" && "bg-destructive/15 text-destructive",
            variant === "opportunity" && "bg-success/15 text-success",
            variant === "info" && "bg-primary/15 text-primary",
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-display text-sm font-semibold leading-tight">{title}</p>
          <p className="text-xs text-muted-foreground">{body}</p>
          {actionUrl && (
            <Link
              to={actionUrl}
              className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              {actionLabel}
              <ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
