import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  CalendarCheck,
  CalendarPlus,
  CheckCircle2,
  ChevronRight,
  Clock,
  History,
  Loader2,
  XCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type EventKind =
  | "created"
  | "accepted"
  | "rejected"
  | "cancelled"
  | "expired"
  | "booked"
  | "booking_cancelled";

interface PartnerMatchEvent {
  invitation_id: string;
  opponent_id: string | null;
  opponent_name: string | null;
  court_name: string | null;
  booking_starts_at: string | null;
  kind: EventKind;
  at: string;
  is_inviter: boolean;
}

const KIND_META: Record<
  EventKind,
  { label: string; Icon: typeof Clock; tone: string }
> = {
  created: { label: "Invitación enviada", Icon: CalendarPlus, tone: "text-primary" },
  accepted: { label: "Invitación aceptada", Icon: CheckCircle2, tone: "text-emerald-600 dark:text-emerald-400" },
  rejected: { label: "Invitación rechazada", Icon: XCircle, tone: "text-destructive" },
  cancelled: { label: "Match cancelado", Icon: XCircle, tone: "text-destructive" },
  expired: { label: "Invitación expirada", Icon: Clock, tone: "text-muted-foreground" },
  booked: { label: "Cancha confirmada", Icon: CalendarCheck, tone: "text-emerald-600 dark:text-emerald-400" },
  booking_cancelled: { label: "Reserva cancelada", Icon: XCircle, tone: "text-destructive" },
};

interface Props {
  userId: string;
}

export const PartnerMatchHistorySection = ({ userId }: Props) => {
  const [events, setEvents] = useState<PartnerMatchEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    supabase
      .rpc("user_partner_match_events", { _user_id: userId, _limit: 30 })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("[PartnerMatchHistorySection]", error);
          setEvents([]);
        } else {
          const obj = (data ?? {}) as { events?: PartnerMatchEvent[] };
          setEvents(obj.events ?? []);
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return (
    <section className="space-y-3 px-5">
      <h2 className="flex items-center gap-2 font-display text-base font-semibold">
        <History className="h-4 w-4" /> Historial de matches con partner
      </h2>

      <div className="rounded-2xl border border-border bg-card p-3 shadow-card">
        {loading ? (
          <div className="flex items-center justify-center py-6 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : events.length === 0 ? (
          <p className="px-2 py-4 text-center text-sm text-muted-foreground">
            Aún no tienes matches con partner.
          </p>
        ) : (
          <ol className="space-y-3">
            {events.map((ev, i) => {
              const meta = KIND_META[ev.kind];
              const Icon = meta.Icon;
              const dt = parseISO(ev.at);
              return (
                <li key={`${ev.invitation_id}-${ev.kind}-${i}`}>
                  <Link
                    to={`/partner/match/${ev.invitation_id}`}
                    className="flex items-start gap-3 rounded-xl px-2 py-2 transition-smooth hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span
                      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted ${meta.tone}`}
                    >
                      <Icon className="h-4 w-4" strokeWidth={2.25} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {meta.label}
                        {ev.opponent_name ? (
                          <span className="text-muted-foreground"> · {ev.opponent_name}</span>
                        ) : null}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {format(dt, "d MMM yyyy · HH:mm", { locale: es })} hrs
                        {ev.court_name ? ` · ${ev.court_name}` : ""}
                      </p>
                    </div>
                    <ChevronRight className="mt-1.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
};
