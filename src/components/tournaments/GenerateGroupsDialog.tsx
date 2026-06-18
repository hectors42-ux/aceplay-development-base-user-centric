import { useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  categoryId: string;
  confirmedCount: number;
  onGenerated: () => void;
}

export const GenerateGroupsDialog = ({
  open,
  onOpenChange,
  categoryId,
  confirmedCount,
  onGenerated,
}: Props) => {
  const [groupsCount, setGroupsCount] = useState(4);
  const [qualifiers, setQualifiers] = useState(2);
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    if (groupsCount < 2) {
      toast({ title: "Se requieren al menos 2 grupos", variant: "destructive" });
      return;
    }
    if (confirmedCount < groupsCount * 2) {
      toast({
        title: "Inscritos insuficientes",
        description: `Se necesitan al menos ${groupsCount * 2} (hay ${confirmedCount}).`,
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    // Persistir qualifiers_per_group antes de generar
    await supabase
      .from("tournament_categories")
      .update({ qualifiers_per_group: qualifiers } as never)
      .eq("id", categoryId);

    const { data, error } = await supabase.rpc("generate_groups" as never, {
      _category_id: categoryId,
      _groups_count: groupsCount,
      _seed_order: null,
    } as never);
    setLoading(false);
    if (error) {
      toast({ title: "No se pudo generar", description: error.message, variant: "destructive" });
      return;
    }
    const matches = (data as { matches_created?: number } | null)?.matches_created ?? 0;
    toast({ title: "Grupos generados", description: `${matches} partidos creados.` });
    onOpenChange(false);
    onGenerated();
  };

  const perGroup = Math.floor(confirmedCount / groupsCount);
  const matchesPreview = groupsCount * (perGroup * (perGroup - 1)) / 2;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generar grupos</DialogTitle>
          <DialogDescription>
            Se distribuirán los {confirmedCount} inscritos confirmados en grupos por siembra serpiente.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="groups_count">Número de grupos</Label>
            <Input
              id="groups_count"
              type="number"
              min={2}
              max={16}
              value={groupsCount}
              onChange={(e) => setGroupsCount(Math.max(2, Math.min(16, Number(e.target.value) || 2)))}
            />
          </div>
          <div>
            <Label htmlFor="qualifiers">Clasifican por grupo</Label>
            <Input
              id="qualifiers"
              type="number"
              min={1}
              max={8}
              value={qualifiers}
              onChange={(e) => setQualifiers(Math.max(1, Math.min(8, Number(e.target.value) || 2)))}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Vista previa: ~{perGroup} por grupo · ~{matchesPreview} partidos.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handle} disabled={loading}>
            {loading && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            Generar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};