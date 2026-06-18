import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  Flag,
  Loader2,
  RefreshCw,
  Trophy,
  UserPlus,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { TournamentHeartbeat } from "./admin/TournamentHeartbeat";
import { AlertCard, type AlertSeverity } from "./admin/AlertCard";
import { AllClearState } from "./admin/AllClearState";
import { LivePulseStrip } from "./admin/LivePulseStrip";

interface Props {
  tournamentId: string;
  tournament?: { starts_at: string | null; ends_at: string | null } | null;
}

interface CategoryRow {
  id: string;
  name: string;
  max_participants: number;
  bracket_generated_at: string | null;
  status: string;
}

interface Counts {
  pendingApprovals: number;
  unscheduled: number;
  resultDisputes: number;
  rescheduleRequests: number;
  readyToFreeze: { catId: string; name: string }[];
  readyToFinalize: { catId: string; name: string }[];
  reviewFlags: number;
  playedTotal: number;
  matchesTotal: number;
  totalRegistered: number;
}

const initialCounts: Counts = {
  pendingApprovals: 0,
  unscheduled: 0,
  resultDisputes: 0,
  rescheduleRequests: 0,
  readyToFreeze: [],
  readyToFinalize: [],
  reviewFlags: 0,
  playedTotal: 0,
  matchesTotal: 0,
  totalRegistered: 0,
};

export const OrganizerSummary = ({ tournamentId, tournament }: Props) => {
  const [counts, setCounts] = useState<Counts>(initialCounts);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    const [{ data: cats }, { data: regs }, { data: matches }, { data: proposals }, { data: resch }, { data: flags }] =
      await Promise.all([
        supabase
          .from("tournament_categories")
          .select("id,name,max_participants,bracket_generated_at,status")
          .eq("tournament_id", tournamentId),
        supabase
          .from("tournament_registrations")
          .select("id,tournament_category_id,status")
          .eq("tournament_id", tournamentId),
        supabase
          .from("tournament_matches")
          .select("id,tournament_category_id,status,scheduled_at,registration_a_id,registration_b_id")
          .eq("tournament_id", tournamentId),
        supabase
          .from("tournament_match_results")
          .select("id,match_id,status")
          .eq("status", "propuesto"),
        supabase
          .from("tournament_match_reschedule_requests")
          .select("id,match_id,status")
          .eq("status", "pendiente"),
        supabase.from("tournament_match_review_flags").select("tournament_match_id"),
      ]);

    const categories = (cats ?? []) as CategoryRow[];
    const catIds = new Set(categories.map((c) => c.id));

    const myMatchIds = new Set(
      (matches ?? []).filter((m) => catIds.has(m.tournament_category_id)).map((m) => m.id),
    );
    const myRegs = (regs ?? []).filter((r) => catIds.has(r.tournament_category_id));

    const confirmedByCat = new Map<string, number>();
    myRegs.forEach((r) => {
      if (r.status === "confirmada") {
        confirmedByCat.set(r.tournament_category_id, (confirmedByCat.get(r.tournament_category_id) ?? 0) + 1);
      }
    });

    const matchesByCat = new Map<string, { total: number; played: number }>();
    (matches ?? [])
      .filter((m) => catIds.has(m.tournament_category_id))
      .forEach((m) => {
        const prev = matchesByCat.get(m.tournament_category_id) ?? { total: 0, played: 0 };
        prev.total += 1;
        if (m.status === "jugado" || m.status === "walkover") prev.played += 1;
        matchesByCat.set(m.tournament_category_id, prev);
      });

    const readyToFreeze = categories
      .filter(
        (c) =>
          !c.bracket_generated_at &&
          (confirmedByCat.get(c.id) ?? 0) >= c.max_participants,
      )
      .map((c) => ({ catId: c.id, name: c.name }));

    const readyToFinalize = categories
      .filter((c) => {
        const mm = matchesByCat.get(c.id);
        return c.status === "en_curso" && mm && mm.total > 0 && mm.played === mm.total;
      })
      .map((c) => ({ catId: c.id, name: c.name }));

    let playedTotal = 0;
    let matchesTotal = 0;
    matchesByCat.forEach((v) => {
      playedTotal += v.played;
      matchesTotal += v.total;
    });

    setCounts({
      pendingApprovals: myRegs.filter((r) => r.status === "pendiente_admin").length,
      unscheduled: (matches ?? []).filter(
        (m) =>
          catIds.has(m.tournament_category_id) &&
          m.status === "pendiente" &&
          m.registration_a_id &&
          m.registration_b_id &&
          !m.scheduled_at,
      ).length,
      resultDisputes: (proposals ?? []).filter((p) => myMatchIds.has(p.match_id)).length,
      rescheduleRequests: (resch ?? []).filter((r) => myMatchIds.has(r.match_id)).length,
      readyToFreeze,
      readyToFinalize,
      reviewFlags: (flags ?? []).filter((f) => myMatchIds.has(f.tournament_match_id)).length,
      playedTotal,
      matchesTotal,
      totalRegistered: myRegs.filter((r) => r.status === "confirmada").length,
    });
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId]);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  const pct =
    counts.matchesTotal > 0 ? Math.round((counts.playedTotal / counts.matchesTotal) * 100) : 0;

  const daysLeft = (() => {
    if (!tournament?.ends_at) return null;
    const ms = new Date(tournament.ends_at).getTime() - Date.now();
    return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
  })();

  const goCat = (catId: string) => navigate(`/admin/torneos/${tournamentId}/cat/${catId}`);
  const goFirstCat = () => {
    const first = counts.readyToFreeze[0] || counts.readyToFinalize[0];
    if (first) goCat(first.catId);
    else navigate(`/admin/torneos/${tournamentId}`);
  };

  type AlertItem = {
    key: string;
    severity: AlertSeverity;
    icon: typeof AlertCircle;
    title: string;
    subtitle: string;
    actionLabel: string;
    onAction: () => void;
  };
  const alerts: AlertItem[] = [];

  if (counts.pendingApprovals > 0)
    alerts.push({
      key: "approvals",
      severity: "warning",
      icon: UserPlus,
      title: `${counts.pendingApprovals} inscripción(es) pendientes`,
      subtitle: "Aprueba o rechaza desde la categoría.",
      actionLabel: "Revisar",
      onAction: goFirstCat,
    });
  if (counts.resultDisputes > 0)
    alerts.push({
      key: "results",
      severity: "destructive",
      icon: AlertCircle,
      title: `${counts.resultDisputes} resultado(s) en disputa`,
      subtitle: "Hay propuestas esperando confirmación.",
      actionLabel: "Resolver",
      onAction: goFirstCat,
    });
  if (counts.rescheduleRequests > 0)
    alerts.push({
      key: "reschedule",
      severity: "primary",
      icon: CalendarClock,
      title: `${counts.rescheduleRequests} reprogramación(es)`,
      subtitle: "Resuelve las propuestas pendientes.",
      actionLabel: "Resolver",
      onAction: goFirstCat,
    });
  if (counts.unscheduled > 0)
    alerts.push({
      key: "unscheduled",
      severity: "primary",
      icon: CalendarClock,
      title: `${counts.unscheduled} partido(s) sin agendar`,
      subtitle: "Asigna cancha y horario.",
      actionLabel: "Programar",
      onAction: goFirstCat,
    });
  counts.readyToFreeze.forEach((c) =>
    alerts.push({
      key: `freeze-${c.catId}`,
      severity: "primary",
      icon: Trophy,
      title: `${c.name} · cupo completo`,
      subtitle: "Genera el cuadro para arrancar.",
      actionLabel: "Generar",
      onAction: () => goCat(c.catId),
    }),
  );
  counts.readyToFinalize.forEach((c) =>
    alerts.push({
      key: `finalize-${c.catId}`,
      severity: "primary",
      icon: CheckCircle2,
      title: `${c.name} · lista para final`,
      subtitle: "Todos los partidos están jugados.",
      actionLabel: "Finalizar",
      onAction: () => goCat(c.catId),
    }),
  );
  if (counts.reviewFlags > 0)
    alerts.push({
      key: "review",
      severity: "warning",
      icon: Flag,
      title: `${counts.reviewFlags} partido(s) marcado(s)`,
      subtitle: "Se corrigió un resultado. Verifica dependientes.",
      actionLabel: "Revisar",
      onAction: goFirstCat,
    });

  return (
    <div className="space-y-4">
      <TournamentHeartbeat
        pct={pct}
        daysLeft={daysLeft}
        matchesPlayed={counts.playedTotal}
        matchesTotal={counts.matchesTotal}
      />

      <LivePulseStrip tournamentId={tournamentId} />

      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Atención requerida
        </h3>
        <button
          type="button"
          onClick={load}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className="h-3 w-3" /> Refrescar
        </button>
      </div>

      {alerts.length === 0 ? (
        <AllClearState
          matchesPlayed={counts.playedTotal}
          matchesTotal={counts.matchesTotal}
          confirmedRegistrations={counts.totalRegistered}
          totalRegistrations={counts.totalRegistered}
        />
      ) : (
        <div className="stagger flex flex-col gap-2">
          {alerts.map((a) => {
            const Icon = a.icon;
            return (
              <AlertCard
                key={a.key}
                severity={a.severity}
                icon={<Icon className="h-4 w-4" />}
                title={a.title}
                subtitle={a.subtitle}
                actionLabel={a.actionLabel}
                onAction={a.onAction}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};