import { ArrowDownRight, ArrowUpRight, Info, Minus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface KpiCardProps {
  label: string;
  value: string | number | null | undefined;
  hint?: string;
  delta?: number | null;
  deltaSuffix?: string;
  invertColor?: boolean;
  icon?: ReactNode;
  loading?: boolean;
  onClick?: () => void;
}

export function KpiCard({
  label,
  value,
  hint,
  delta,
  deltaSuffix = "%",
  invertColor = false,
  icon,
  loading,
  onClick,
}: KpiCardProps) {
  const showDelta = delta !== null && delta !== undefined && !Number.isNaN(delta);
  const positiveIsGood = !invertColor;
  let deltaTone: "good" | "bad" | "neutral" = "neutral";
  if (showDelta) {
    if (delta! > 0) deltaTone = positiveIsGood ? "good" : "bad";
    else if (delta! < 0) deltaTone = positiveIsGood ? "bad" : "good";
  }

  return (
    <Card
      onClick={onClick}
      className={cn(
        "rounded-2xl border-border/60 transition-shadow",
        onClick && "cursor-pointer hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring",
      )}
      tabIndex={onClick ? 0 : undefined}
      aria-label={label}
    >
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {icon}
            <span>{label}</span>
          </div>
          {hint && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="text-muted-foreground/60 hover:text-muted-foreground" aria-label="Más info">
                  <Info className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-xs">{hint}</TooltipContent>
            </Tooltip>
          )}
        </div>
        <div className="flex items-end justify-between gap-2">
          {loading ? (
            <Skeleton className="h-8 w-24" />
          ) : (
            <p className="font-display text-2xl font-semibold leading-none tabular-nums">
              {value ?? "—"}
            </p>
          )}
          {showDelta && !loading && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-medium",
                deltaTone === "good" && "bg-success/15 text-success",
                deltaTone === "bad" && "bg-destructive/15 text-destructive",
                deltaTone === "neutral" && "bg-muted text-muted-foreground",
              )}
            >
              {deltaTone === "good" ? (
                <ArrowUpRight className="h-3 w-3" />
              ) : deltaTone === "bad" ? (
                <ArrowDownRight className="h-3 w-3" />
              ) : (
                <Minus className="h-3 w-3" />
              )}
              {Math.abs(delta!).toFixed(1)}
              {deltaSuffix}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
