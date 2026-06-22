import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatLevel, formatDelta, getDeltaColor } from "@/lib/rating-utils";
import type { RatingHistoryRow } from "@/lib/rating-utils";
import { cn } from "@/lib/utils";

const SOURCE_LABEL: Record<string, string> = {
  onboarding: "Test inicial de nivel",
  ladder_challenge: "Desafío de Escalerilla",
  match_ladder: "Desafío de Escalerilla",
  tournament_match: "Partido de torneo",
  match_tournament: "Partido de torneo",
  match_open: "Partido amistoso",
  clase: "Clase con coach",
  manual_admin: "Ajuste del club",
  manual_self: "Ajuste personal",
  decay: "Bajada por inactividad",
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  history: RatingHistoryRow[];
}

export const EvolutionDetailSheet = ({ open, onOpenChange, history }: Props) => {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-md p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border px-5 py-4">
          <SheetTitle>Detalle de cambios de nivel</SheetTitle>
          <SheetDescription>
            Cada movimiento de tu nivel con fecha, origen y nuevo valor.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-92px)]">
          <div className="space-y-2 p-4">
            {history.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border bg-card/50 p-6 text-center text-sm text-muted-foreground">
                Aún no hay cambios registrados.
              </p>
            ) : (
              history.map((h) => {
                const delta = Number(h.delta);
                return (
                  <div
                    key={h.id}
                    className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {SOURCE_LABEL[h.source] ?? h.source}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {format(new Date(h.recorded_at), "d MMM yyyy · HH:mm", {
                          locale: es,
                        })}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-0.5">
                      <span
                        className={cn(
                          "font-display text-sm font-bold",
                          getDeltaColor(delta),
                        )}
                      >
                        {formatDelta(delta)}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        → {formatLevel(h.level_after)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};
