import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { MyEvolutionTab } from "@/components/ranking/MyEvolutionTab";
import type { RankingSport } from "@/hooks/useClubRanking";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sport: RankingSport;
}

/**
 * Subventana del Perfil que muestra la evolución de nivel del jugador.
 * Reusa MyEvolutionTab (antes vivía como pestaña dentro de Ranking).
 */
export const EvolutionSheet = ({ open, onOpenChange, sport }: Props) => {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[92vh] overflow-y-auto rounded-t-3xl px-4 pb-8 pt-4 md:max-w-xl md:mx-auto"
      >
        <SheetHeader className="mb-3 text-left">
          <SheetTitle className="font-display text-lg">Evolución de nivel</SheetTitle>
        </SheetHeader>
        <MyEvolutionTab sport={sport} ranking={[]} hideProfileLink />
      </SheetContent>
    </Sheet>
  );
};
