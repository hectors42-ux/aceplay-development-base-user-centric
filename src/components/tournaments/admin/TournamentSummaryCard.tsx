import { Dot, RotateCcw, Loader2 } from "lucide-react";
import { useState } from "react";
import { useCountUp } from "@/components/feedback/useCountUp";
import { HapticButton } from "@/components/feedback/HapticButton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreVertical } from "lucide-react";

export interface SummaryStat {
  value: number;
  label: string;
}

interface Props {
  stats: SummaryStat[];
  status: "generado" | "pendiente";
  lastGeneratedAt?: string | null;
  onResort?: () => Promise<void> | void;
  resorting?: boolean;
}

function StatNumber({ value }: { value: number }) {
  const animated = useCountUp(value, { duration: 800 });
  return <span className="font-serif text-3xl text-ink">{animated}</span>;
}

function relativeFromNow(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "recién";
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `hace ${hrs} h`;
  const days = Math.round(hrs / 24);
  return `hace ${days} d`;
}

export function TournamentSummaryCard({
  stats,
  status,
  lastGeneratedAt,
  onResort,
  resorting,
}: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const isGenerated = status === "generado";
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.32em] text-muted-foreground">
          <Dot className={isGenerated ? "h-5 w-5 text-primary" : "h-5 w-5 text-muted-foreground"} />
          {isGenerated ? "Sorteo generado" : "Sin sortear"}
        </div>
        <div className="flex items-center gap-2">
          {lastGeneratedAt && (
            <span className="text-xs text-muted-foreground">{relativeFromNow(lastGeneratedAt)}</span>
          )}
          {onResort && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Más opciones">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setConfirmOpen(true); }}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Re-sortear todo
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="text-center">
            <StatNumber value={s.value} />
            <div className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {onResort && (
        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogTrigger className="hidden" />
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Re-sortear todo?</AlertDialogTitle>
              <AlertDialogDescription>
                Esto descarta todas las parejas de las rondas no jugadas y vuelve a sortear desde la
                actual. Las rondas finalizadas se conservan.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction asChild>
                <HapticButton
                  level="warning"
                  onClick={async () => {
                    await onResort();
                    setConfirmOpen(false);
                  }}
                  disabled={resorting}
                >
                  {resorting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Re-sortear
                </HapticButton>
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}