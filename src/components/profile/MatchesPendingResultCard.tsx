import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { AlertCircle, ArrowRight, Check, Loader2, Trophy, Swords, Handshake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import type { PendingLadderMatch, PendingTournamentMatch } from "@/hooks/useMatchHistory";
import { usePartnerPendingResults } from "@/hooks/usePartnerPendingResults";
import { cn } from "@/lib/utils";

interface Props {
  userId: string;
  pendingTournaments: PendingTournamentMatch[];
  pendingLadder: PendingLadderMatch[];
}

/**
 * Tarjeta dentro del perfil propio que muestra los partidos que requieren tu acción:
 *  - Cargar resultado de partido jugado
 *  - Confirmar resultado propuesto por el rival
 *
 * Para torneos: link directo a la categoría con ?openResult=<matchId>
 * Para Escalerilla: confirma directo desde la card (acción de 1 toque) o link a /ladder.
 */
export const MatchesPendingResultCard = ({ userId, pendingTournaments, pendingLadder }: Props) => {
  const qc = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);
  const { data: pendingPartner = [] } = usePartnerPendingResults();

  const items = useMemo(() => {
    const tIts = pendingTournaments.map((t) => ({ kind: "tournament" as const, key: t.match_id, data: t }));
    const lIts = pendingLadder.map((l) => ({ kind: "ladder" as const, key: l.challenge_id, data: l }));
    const pIts = pendingPartner.map((p) => ({ kind: "partner" as const, key: p.invitation_id, data: p }));
    const all = [...tIts, ...lIts, ...pIts];
    return all.sort((a, b) => {
      const urgent = (it: typeof a) =>
        (it.kind === "ladder" && it.data.needs_action === "confirm") ||
        (it.kind === "partner" && it.data.needs_action === "confirm")
          ? 0
          : 1;
      return urgent(a) - urgent(b);
    });
  }, [pendingTournaments, pendingLadder, pendingPartner]);

  if (items.length === 0) return null;

  const confirmLadder = async (challengeId: string) => {
    setBusyId(challengeId);
    const { error } = await supabase.rpc("confirm_ladder_result", { _challenge_id: challengeId });
    setBusyId(null);
    if (error) {
      toast.error("No se pudo confirmar", { description: error.message });
      return;
    }
    toast.success("Resultado confirmado");
    void qc.invalidateQueries({ queryKey: ["match-history", userId] });
    void qc.invalidateQueries({ queryKey: ["pending-actions"] });
    void qc.invalidateQueries({ queryKey: ["profile-summary", userId] });
  };

  return (
    <div className="rounded-3xl border border-warning/40 bg-warning/5 p-3">
      <div className="mb-2 flex items-center gap-2">
        <AlertCircle className="h-3.5 w-3.5 text-warning" />
        <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground">
          Pendiente de tu parte ({items.length})
        </p>
      </div>
      <ul className="space-y-2">
        {items.map((it) => {
          if (it.kind === "tournament") {
            const t = it.data;
            const dateLabel = t.scheduled_at
              ? format(parseISO(t.scheduled_at), "d 'de' MMM · HH:mm", { locale: es })
              : "Sin fecha";
            const isOverdue = t.scheduled_at ? parseISO(t.scheduled_at) < new Date() : false;
            return (
              <li
                key={it.key}
                className="flex items-start gap-2 rounded-2xl border border-border bg-card p-2.5"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <Trophy className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold leading-tight">vs {t.opponent_name}</p>
                  <p className="truncate text-[10px] text-muted-foreground">
                    {t.tournament_name} · {t.category_name}
                  </p>
                  <p className={cn("text-[10px]", isOverdue ? "font-semibold text-warning" : "text-muted-foreground")}>
                    {dateLabel}
                    {t.has_pending_proposal && " · propuesta enviada"}
                  </p>
                </div>
                <Button
                  asChild
                  size="sm"
                  variant={t.has_pending_proposal ? "outline" : "default"}
                  className="h-7 shrink-0 px-2.5 text-[10px]"
                >
                  <Link to={`/torneos/${t.tournament_slug}/cat/${t.category_id}?openResult=${t.match_id}`}>
                    {t.has_pending_proposal ? "Ver" : "Cargar"}
                    <ArrowRight className="ml-0.5 h-3 w-3" />
                  </Link>
                </Button>
              </li>
            );
          }

          if (it.kind === "partner") {
            const p = it.data;
            const dateLabel = format(parseISO(p.scheduled_at), "d 'de' MMM · HH:mm", { locale: es });
            const isConfirm = p.needs_action === "confirm";
            const isWait = p.needs_action === "wait";
            return (
              <li
                key={it.key}
                className={cn(
                  "flex items-start gap-2 rounded-2xl border p-2.5",
                  isConfirm ? "border-warning/40 bg-warning/10" : "border-border bg-card",
                )}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <Handshake className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold leading-tight">vs {p.opponent_name}</p>
                  <p className="truncate text-[10px] text-muted-foreground">Amistoso</p>
                  <p className="text-[10px] text-muted-foreground">
                    {dateLabel}
                    {isConfirm && " · el rival propuso un resultado"}
                    {isWait && " · esperando confirmación"}
                  </p>
                </div>
                <Button asChild size="sm" variant={isWait ? "ghost" : "default"} className="h-7 shrink-0 px-2.5 text-[10px]">
                  <Link to={`/partner/match/${p.invitation_id}`}>
                    {isConfirm ? "Confirmar" : isWait ? "Ver" : "Cargar"}
                    <ArrowRight className="ml-0.5 h-3 w-3" />
                  </Link>
                </Button>
              </li>
            );
          }

          // ladder
          const l = it.data;
          const dateLabel = l.scheduled_at
            ? format(parseISO(l.scheduled_at), "d 'de' MMM · HH:mm", { locale: es })
            : "Sin fecha";
          const isConfirm = l.needs_action === "confirm";
          const isWait = l.needs_action === "wait";
          return (
            <li
              key={it.key}
              className={cn(
                "flex items-start gap-2 rounded-2xl border p-2.5",
                isConfirm ? "border-warning/40 bg-warning/10" : "border-border bg-card",
              )}
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/20 text-accent-foreground">
                <Swords className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold leading-tight">vs {l.opponent_name}</p>
                <p className="truncate text-[10px] text-muted-foreground">
                  Escalerilla · {l.ladder_name}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {dateLabel}
                  {isConfirm && " · el rival propuso un resultado"}
                  {isWait && " · esperando confirmación"}
                </p>
              </div>
              {isConfirm ? (
                <Button
                  size="sm"
                  variant="default"
                  className="h-7 shrink-0 px-2.5 text-[10px]"
                  disabled={busyId === l.challenge_id}
                  onClick={() => confirmLadder(l.challenge_id)}
                >
                  {busyId === l.challenge_id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <>
                      <Check className="mr-0.5 h-3 w-3" /> Confirmar
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  asChild
                  size="sm"
                  variant={isWait ? "ghost" : "default"}
                  className="h-7 shrink-0 px-2.5 text-[10px]"
                >
                  <Link to="/ranking?tab=piramide&focus=challenges">
                    {isWait ? "Ver" : "Cargar"}
                    <ArrowRight className="ml-0.5 h-3 w-3" />
                  </Link>
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};
