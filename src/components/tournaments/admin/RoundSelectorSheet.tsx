import { useState } from "react";
import { Check, ChevronRight, AlertTriangle } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import type { AmericanoRound } from "@/hooks/useAmericanoRounds";

interface Props {
  rounds: AmericanoRound[];
  currentRoundId: string | undefined;
  onSelect: (round: AmericanoRound) => void;
}

const STATUS_LABEL: Record<AmericanoRound["status"], string> = {
  pendiente: "Programada",
  en_juego: "En juego",
  finalizada: "Finalizada",
};

const STATUS_CHIP: Record<AmericanoRound["status"], string> = {
  pendiente: "bg-muted text-foreground",
  en_juego: "bg-primary/15 text-primary",
  finalizada: "bg-olive/15 text-olive",
};

export function RoundSelectorSheet({ rounds, currentRoundId, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const [pendingFinalized, setPendingFinalized] = useState<AmericanoRound | null>(null);

  const handlePick = (r: AmericanoRound) => {
    if (r.status === "finalizada") {
      setPendingFinalized(r);
      return;
    }
    onSelect(r);
    setOpen(false);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="sm" className="text-xs">
            Cambiar ronda <ChevronRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="max-h-[70vh]">
          <SheetHeader>
            <SheetTitle className="font-serif">Elegir ronda</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-2">
            {rounds.map((r) => (
              <button
                key={r.id}
                onClick={() => handlePick(r)}
                className={`flex w-full items-center justify-between rounded-lg border p-3 text-left transition ${
                  r.id === currentRoundId
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="font-serif text-lg">Ronda {r.round_number}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider ${STATUS_CHIP[r.status]}`}
                  >
                    {STATUS_LABEL[r.status]}
                  </span>
                </div>
                {r.id === currentRoundId && <Check className="h-4 w-4 text-primary" />}
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      {pendingFinalized && (
        <Sheet open onOpenChange={(o) => !o && setPendingFinalized(null)}>
          <SheetContent side="bottom">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2 font-serif">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                Editar ronda finalizada
              </SheetTitle>
            </SheetHeader>
            <p className="mt-3 text-sm text-muted-foreground">
              Estás por editar la <strong>Ronda {pendingFinalized.round_number}</strong>, que ya
              está finalizada. Si modificas las parejas, los resultados quedan invalidados y deberán
              recargarse manualmente.
            </p>
            <div className="mt-4 flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setPendingFinalized(null)}>
                Cancelar
              </Button>
              <Button
                className="flex-1"
                onClick={() => {
                  onSelect(pendingFinalized);
                  setPendingFinalized(null);
                  setOpen(false);
                }}
              >
                Editar igual
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      )}
    </>
  );
}