import { Link } from "react-router-dom";
import { ArrowRight, CalendarCheck, Clock, User } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { dayLabel } from "@/lib/booking-utils";

interface NextBooking {
  id: string;
  starts_at: string;
  ends_at: string;
  court_name: string | null;
  other_first_name: string | null;
  other_last_name: string | null;
  i_am_owner: boolean;
}

/**
 * Variante del Hero cuando hay una próxima reserva (modo interno).
 */
export const HeroBookingNext = ({ next }: { next: NextBooking }) => {
  const start = parseISO(next.starts_at);
  const end = parseISO(next.ends_at);
  const partnerName = next.other_first_name
    ? `${next.other_first_name} ${(next.other_last_name ?? "").charAt(0)}.`
    : null;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 pr-24">
        <div className="inline-flex w-fit items-center gap-1 rounded-full bg-success/50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-success-foreground backdrop-blur-md">
          <CalendarCheck className="h-2.5 w-2.5" strokeWidth={2.6} />
          {next.i_am_owner ? "Tu próxima reserva" : "Te invitaron a jugar"}
        </div>
      </div>

      <div className="space-y-1.5 text-white">
        <h1 className="font-display text-4xl font-semibold leading-[1.05] tracking-tight md:text-5xl">
          {next.court_name ?? "Cancha"}
        </h1>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/90">
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" strokeWidth={2.4} />
            {dayLabel(start)} · {format(start, "HH:mm")}—{format(end, "HH:mm")}
          </span>
          {partnerName && (
            <span className="inline-flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" strokeWidth={2.4} />
              {next.i_am_owner ? "Con " : "Invita "}
              {partnerName}
            </span>
          )}
        </div>
      </div>

      <Link to="/mis-reservas" className="w-fit">
        <Button variant="clay" size="lg" aria-label="Ver mis reservas">
          Ver detalle
          <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
        </Button>
      </Link>
    </>
  );
};
