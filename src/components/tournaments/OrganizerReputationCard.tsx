import { Trophy, BadgeCheck, ShieldCheck, CalendarClock } from "lucide-react";
import { formatDistanceToNowStrict, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import type { OrganizerReputation } from "@/hooks/useOrganizerReputation";

export const OrganizerReputationCard = ({ rep }: { rep: OrganizerReputation | null }) => {
  const tClosed = rep?.tournaments_closed ?? 0;
  const verified = rep?.verified_matches ?? 0;
  const confirmed = rep?.confirmed_both_sides_pct ?? 0;
  const seniority = rep?.first_tournament_at
    ? formatDistanceToNowStrict(parseISO(rep.first_tournament_at), { locale: es })
    : "—";

  return (
    <div className="rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card p-5 shadow-clay">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-primary" />
        <p className="text-[10px] uppercase tracking-[0.32em] text-muted-foreground">
          Tu reputación como organizador
        </p>
      </div>
      <p className="mt-2 font-display text-2xl font-semibold italic text-primary">
        Tu currículum en la cancha.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Stat icon={<Trophy className="h-4 w-4" />} label="Torneos cerrados" value={tClosed} />
        <Stat icon={<BadgeCheck className="h-4 w-4" />} label="Partidos verificados" value={verified} />
        <Stat icon={<ShieldCheck className="h-4 w-4" />} label="Confirmados por ambos" value={`${confirmed}%`} />
        <Stat icon={<CalendarClock className="h-4 w-4" />} label="Antigüedad" value={seniority} />
      </div>
    </div>
  );
};

const Stat = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) => (
  <div className="rounded-2xl border border-border bg-background/60 p-3">
    <div className="flex items-center gap-1.5 text-muted-foreground">
      {icon}
      <span className="text-[10px] uppercase tracking-[0.24em]">{label}</span>
    </div>
    <p className="mt-1 font-display text-lg font-semibold">{value}</p>
  </div>
);