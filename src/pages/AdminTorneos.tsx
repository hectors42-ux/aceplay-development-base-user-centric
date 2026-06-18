import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Trophy, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/EmptyState";
import { TournamentFormDialog } from "@/components/tournaments/TournamentFormDialog";
import { DeleteTournamentDialog } from "@/components/tournaments/DeleteTournamentDialog";
import { toast } from "@/hooks/use-toast";
import {
  TOURNAMENT_STATUS_LABEL,
  TOURNAMENT_STATUS_TRANSITION_LABEL,
  nextAllowedStatuses,
  tournamentStatusColor,
  type TournamentStatus,
} from "@/lib/tournament-utils";
import type { Tables } from "@/integrations/supabase/types";

type Tournament = Tables<"tournaments"> & {
  tournament_categories: Pick<Tables<"tournament_categories">, "id" | "name">[];
};

const AdminTorneos = () => {
  const navigate = useNavigate();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTournament, setEditTournament] = useState<Tournament | null>(null);
  const [deleteTournament, setDeleteTournament] = useState<Tournament | null>(null);

  const load = async () => {
    const { data } = await supabase
      .from("tournaments")
      .select("*, tournament_categories(id, name)")
      .order("created_at", { ascending: false });
    setTournaments((data ?? []) as Tournament[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleStatusChange = async (t: Tournament, status: TournamentStatus) => {
    const patch: {
      status: TournamentStatus;
      registration_opens_at?: string;
      registration_closes_at?: string;
      starts_at?: string;
      ends_at?: string;
    } = { status };
    const nowIso = new Date().toISOString();
    if (status === "inscripciones_abiertas" && new Date(t.registration_opens_at) > new Date()) {
      patch.registration_opens_at = nowIso;
    }
    if (status === "inscripciones_cerradas" && new Date(t.registration_closes_at) > new Date()) {
      patch.registration_closes_at = nowIso;
    }
    if (status === "en_curso" && new Date(t.starts_at) > new Date()) {
      patch.starts_at = nowIso;
    }
    if (status === "finalizado" && new Date(t.ends_at) > new Date()) {
      patch.ends_at = nowIso;
    }
    const { error } = await supabase.from("tournaments").update(patch).eq("id", t.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Estado actualizado", description: TOURNAMENT_STATUS_LABEL[status] });
    load();
  };

  return (
    <div className="min-h-screen bg-gradient-warm pb-12">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-5 py-4">
          <Link
            to="/"
            className="flex h-9 w-9 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground hover:text-foreground"
            aria-label="Volver"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1">
            <h1 className="font-display text-xl font-semibold">Administrar torneos</h1>
            <p className="text-xs text-muted-foreground">Crea eventos con múltiples categorías</p>
          </div>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1 h-4 w-4" /> Nuevo
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-3 px-5 pt-4">
        {loading ? (
          <p className="text-center text-sm text-muted-foreground">Cargando…</p>
        ) : tournaments.length === 0 ? (
          <EmptyState
            icon={Trophy}
            title="Sin torneos creados"
            description="Crea el primer evento (ej. Apertura 2026) y luego agrégale categorías."
          />
        ) : (
          tournaments.map((t) => {
            const status = t.status as TournamentStatus;
            const cats = t.tournament_categories ?? [];
            const transitions = nextAllowedStatuses(status).filter((s) => {
              // No mostrar "Abrir inscripciones" si aún no hay categorías
              if (s === "inscripciones_abiertas" && cats.length === 0) return false;
              return true;
            });
            const canDelete =
              status === "borrador" || status === "cancelado" || status === "finalizado";
            return (
              <div key={t.id} className="rounded-3xl border border-border bg-card p-4 shadow-card">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate font-display text-base font-semibold">{t.name}</h3>
                    <p className="truncate text-xs text-muted-foreground">
                      {cats.length === 0
                        ? "Sin categorías — agrégalas en Gestionar"
                        : cats.map((c) => c.name).join(" · ")}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {format(parseISO(t.starts_at), "d MMM yyyy", { locale: es })}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${tournamentStatusColor(status)}`}
                  >
                    {TOURNAMENT_STATUS_LABEL[status]}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate(`/admin/torneos/${t.id}`)}
                  >
                    Gestionar
                  </Button>
                  {transitions.length > 0 && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm">Cambiar estado</Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        {transitions.map((s) => (
                          <DropdownMenuItem
                            key={s}
                            onClick={() => handleStatusChange(t, s)}
                          >
                            {TOURNAMENT_STATUS_TRANSITION_LABEL[s]}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="ghost" aria-label="Más acciones">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setEditTournament(t)}>
                        <Pencil className="mr-2 h-4 w-4" /> Editar datos
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        disabled={!canDelete}
                        onClick={() => canDelete && setDeleteTournament(t)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })
        )}
      </main>

      <TournamentFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        onSaved={load}
      />
      <TournamentFormDialog
        open={!!editTournament}
        onOpenChange={(v) => !v && setEditTournament(null)}
        mode="edit"
        tournament={editTournament}
        onSaved={load}
      />
      <DeleteTournamentDialog
        open={!!deleteTournament}
        onOpenChange={(v) => !v && setDeleteTournament(null)}
        tournament={deleteTournament}
        onDeleted={load}
      />
    </div>
  );
};

export default AdminTorneos;
