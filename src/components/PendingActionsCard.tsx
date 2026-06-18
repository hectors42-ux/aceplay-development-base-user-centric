import { Link } from "react-router-dom";
import { ChevronRight, Swords, Trophy, Users, CalendarClock, CheckCircle2, Handshake } from "lucide-react";
import { usePendingActions } from "@/hooks/usePendingActions";

export const PendingActionsCard = () => {
  const {
    loading,
    ladderChallengesReceived,
    ladderResultsToConfirm,
    tournamentResultsToConfirm,
    doublesInvitations,
    rescheduleRequests,
    partnerResultsToLoad,
    partnerResultsToConfirm,
    total,
  } = usePendingActions();

  if (loading || total === 0) return null;

  const items: { icon: typeof Swords; label: string; count: number; to: string; tone: string }[] = [];
  if (ladderChallengesReceived > 0)
    items.push({
      icon: Swords,
      label: ladderChallengesReceived === 1 ? "Desafío recibido" : "Desafíos recibidos",
      count: ladderChallengesReceived,
      to: "/ladder?tab=piramide&focus=challenges",
      tone: "bg-primary/10 text-primary",
    });
  if (ladderResultsToConfirm > 0)
    items.push({
      icon: CheckCircle2,
      label: "Resultado por confirmar",
      count: ladderResultsToConfirm,
      to: "/ladder?tab=piramide&focus=challenges",
      tone: "bg-success/10 text-success",
    });
  if (tournamentResultsToConfirm > 0)
    items.push({
      icon: Trophy,
      label: "Resultado de torneo",
      count: tournamentResultsToConfirm,
      to: "/torneos",
      tone: "bg-accent/15 text-accent-foreground",
    });
  if (doublesInvitations > 0)
    items.push({
      icon: Users,
      label: doublesInvitations === 1 ? "Invitación de dobles" : "Invitaciones de dobles",
      count: doublesInvitations,
      to: "/torneos",
      tone: "bg-primary/10 text-primary",
    });
  if (partnerResultsToConfirm > 0)
    items.push({
      icon: CheckCircle2,
      label: partnerResultsToConfirm === 1 ? "Confirmar amistoso" : "Confirmar amistosos",
      count: partnerResultsToConfirm,
      to: "/perfil",
      tone: "bg-success/10 text-success",
    });
  if (partnerResultsToLoad > 0)
    items.push({
      icon: Handshake,
      label: partnerResultsToLoad === 1 ? "Cargar resultado amistoso" : "Cargar resultados amistosos",
      count: partnerResultsToLoad,
      to: "/perfil",
      tone: "bg-primary/10 text-primary",
    });
  if (rescheduleRequests > 0)
    items.push({
      icon: CalendarClock,
      label: "Solicitud de reagendar",
      count: rescheduleRequests,
      to: "/torneos",
      tone: "bg-warning/15 text-warning",
    });

  return (
    <section aria-labelledby="pendientes-titulo" className="px-5">
      <div className="mb-3 flex items-center justify-between">
        <h2
          id="pendientes-titulo"
          className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground"
        >
          Requiere tu atención
        </h2>
        <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
          {total}
        </span>
      </div>
      <div className="space-y-2">
        {items.map((it, i) => {
          const Icon = it.icon;
          return (
            <Link
              key={it.label}
              to={it.to}
              style={{ animationDelay: `${i * 60}ms` }}
              className="group flex animate-fade-in-up items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-card transition-smooth hover:-translate-y-0.5 hover:shadow-elevated"
            >
              <span className={`flex h-10 w-10 items-center justify-center rounded-2xl ${it.tone}`}>
                <Icon className="h-5 w-5" strokeWidth={2.2} />
              </span>
              <div className="flex-1">
                <p className="text-sm font-semibold leading-tight text-foreground">{it.label}</p>
                <p className="text-[11px] text-muted-foreground">
                  {it.count} pendiente{it.count === 1 ? "" : "s"} · toca para resolver
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground transition-smooth group-hover:translate-x-0.5 group-hover:text-primary" />
            </Link>
          );
        })}
      </div>
    </section>
  );
};
