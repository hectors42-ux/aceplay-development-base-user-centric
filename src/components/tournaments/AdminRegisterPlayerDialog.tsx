import { useEffect, useMemo, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";
import type { Category, Registration } from "@/hooks/useCategoryData";

type ProfileRow = Pick<Tables<"profiles">, "user_id" | "first_name" | "last_name">;

interface AdminRegisterPlayerDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  category: Category;
  registrations: Registration[];
  onRegistered: () => void;
}

export const AdminRegisterPlayerDialog = ({
  open,
  onOpenChange,
  category,
  registrations,
  onRegistered,
}: AdminRegisterPlayerDialogProps) => {
  const { profile } = useAuth();
  const isDoubles = category.discipline === "tenis_dobles";

  const [search, setSearch] = useState("");
  const [allProfiles, setAllProfiles] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [player1, setPlayer1] = useState<ProfileRow | null>(null);
  const [player2, setPlayer2] = useState<ProfileRow | null>(null);

  useEffect(() => {
    if (!open || !profile?.tenant_id) return;
    let cancel = false;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from("profiles_directory")
        .select("user_id, first_name, last_name")
        .eq("tenant_id", profile.tenant_id)
        .order("first_name", { ascending: true });
      if (!cancel) {
        setAllProfiles((data ?? []) as ProfileRow[]);
        setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [open, profile?.tenant_id]);

  const alreadyRegistered = useMemo(() => {
    const set = new Set<string>();
    for (const r of registrations) {
      if (r.status === "rechazada" || r.status === "retirada") continue;
      if (r.player1_user_id) set.add(r.player1_user_id);
      if (r.player2_user_id) set.add(r.player2_user_id);
    }
    return set;
  }, [registrations]);

  const confirmedCount = useMemo(
    () => registrations.filter((r) => r.status === "confirmada").length,
    [registrations],
  );
  const cupoDisponible = category.max_participants - confirmedCount;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allProfiles
      .filter((p) => !alreadyRegistered.has(p.user_id))
      .filter((p) => {
        if (!q) return true;
        const name = `${p.first_name ?? ""} ${p.last_name ?? ""}`.toLowerCase();
        return name.includes(q);
      })
      .slice(0, 30);
  }, [allProfiles, alreadyRegistered, search]);

  const reset = () => {
    setSearch("");
    setPlayer1(null);
    setPlayer2(null);
  };

  const handlePick = (p: ProfileRow) => {
    if (!player1) {
      setPlayer1(p);
      setSearch("");
      return;
    }
    if (isDoubles && !player2 && p.user_id !== player1.user_id) {
      setPlayer2(p);
      setSearch("");
    }
  };

  const handleSubmit = async () => {
    if (!player1 || !profile) return;
    if (isDoubles && !player2) {
      toast({ title: "Selecciona ambos jugadores", variant: "destructive" });
      return;
    }
    if (cupoDisponible < 1) {
      toast({ title: "Sin cupo disponible", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("tournament_registrations").insert({
      tournament_id: category.tournament_id,
      tournament_category_id: category.id,
      tenant_id: profile.tenant_id,
      player1_user_id: player1.user_id,
      player2_user_id: isDoubles ? player2!.user_id : null,
      status: "confirmada",
      confirmed_at: new Date().toISOString(),
    });
    setSubmitting(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Socio inscrito", description: "Inscripción confirmada por el admin." });
    onOpenChange(false);
    reset();
    onRegistered();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Inscribir socio manualmente</DialogTitle>
          <DialogDescription>
            {isDoubles ? "Elige a los 2 socios" : "Elige al socio"}. La inscripción queda
            confirmada al instante. Cupo disponible: {cupoDisponible} de {category.max_participants}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {(player1 || player2) && (
            <div className="space-y-2">
              {player1 && (
                <div className="flex items-center justify-between rounded-2xl border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
                  <span>
                    <span className="text-xs text-muted-foreground">Jugador 1: </span>
                    <span className="font-medium">
                      {player1.first_name} {player1.last_name}
                    </span>
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setPlayer1(null)}
                    aria-label="Quitar"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
              {player2 && (
                <div className="flex items-center justify-between rounded-2xl border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
                  <span>
                    <span className="text-xs text-muted-foreground">Jugador 2: </span>
                    <span className="font-medium">
                      {player2.first_name} {player2.last_name}
                    </span>
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setPlayer2(null)}
                    aria-label="Quitar"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          )}

          {(!player1 || (isDoubles && !player2)) && (
            <>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar socio por nombre"
                  className="pl-9"
                />
              </div>
              <div className="max-h-[40vh] space-y-1 overflow-y-auto rounded-2xl border border-border bg-card/50 p-2">
                {loading ? (
                  <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cargando socios…
                  </div>
                ) : filtered.length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted-foreground">
                    Sin socios para mostrar.
                  </p>
                ) : (
                  filtered.map((p) => (
                    <button
                      key={p.user_id}
                      type="button"
                      onClick={() => handlePick(p)}
                      className="w-full rounded-xl px-3 py-2 text-left text-sm transition-smooth hover:bg-muted"
                    >
                      {p.first_name} {p.last_name}
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !player1 || (isDoubles && !player2) || cupoDisponible < 1}
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Inscribir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
