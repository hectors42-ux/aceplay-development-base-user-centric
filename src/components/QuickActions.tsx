import { CalendarPlus, Swords, Trophy, GraduationCap, ArrowRight, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { useBookingsProvider, openExternalBooking } from "@/hooks/useBookingsProvider";
import { EXTERNAL_BOOKING_COPY } from "@/lib/external-bookings-copy";

const primaryAction = {
  id: "competir",
  label: "Competir",
  description: "Desafíos, Pirámide y partners",
  icon: Swords,
  to: "/ranking",
};

const secondaryActions = [
  {
    id: "reservar",
    label: "Reservar",
    icon: CalendarPlus,
    to: "/reservar",
  },
  {
    id: "torneo",
    label: "Torneos",
    icon: Trophy,
    to: "/torneos",
  },
  {
    id: "clase",
    label: "Clase",
    icon: GraduationCap,
    to: "/clases",
  },
] as const;

export const QuickActions = () => {
  const PrimaryIcon = primaryAction.icon;
  const { isExternal, externalUrl } = useBookingsProvider();

  return (
    <section aria-labelledby="acciones-titulo" className="px-5 space-y-3">
      <h2
        id="acciones-titulo"
        className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground"
      >
        ¿Qué quieres hacer hoy?
      </h2>

      <Link
        to={primaryAction.to}
        className="group flex items-center gap-4 rounded-xl bg-gradient-clay p-5 text-primary-foreground shadow-clay transition-smooth hover:-translate-y-0.5 animate-fade-in-up"
      >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-white/20">
          <PrimaryIcon className="h-6 w-6" strokeWidth={2.2} />
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-display text-xl font-semibold leading-tight">{primaryAction.label}</p>
          <p className="mt-0.5 text-xs opacity-85">{primaryAction.description}</p>
        </div>
        <ArrowRight
          className="h-5 w-5 shrink-0 transition-transform group-hover:translate-x-0.5"
          strokeWidth={2.2}
        />
      </Link>

      <div className="grid grid-cols-3 gap-2">
        {secondaryActions.map((action, i) => {
          const isReservar = action.id === "reservar";
          const Icon = isReservar && isExternal ? ExternalLink : action.icon;
          const className =
            "group flex flex-col items-center justify-center gap-2 rounded-xl border border-border bg-card p-3 text-foreground transition-smooth hover:border-primary/40 hover:bg-muted animate-fade-in-up";
          const style = { animationDelay: `${(i + 1) * 60}ms` };
          const inner = (
            <>
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-primary transition-smooth group-hover:bg-primary/10">
                <Icon className="h-4 w-4" strokeWidth={2.2} />
              </span>
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {action.label}
              </p>
            </>
          );
          if (isReservar && isExternal) {
            return (
              <button
                key={action.id}
                type="button"
                onClick={() => openExternalBooking(externalUrl)}
                style={style}
                aria-label={EXTERNAL_BOOKING_COPY.ariaOpen}
                className={className}
              >
                {inner}
              </button>
            );
          }
          return (
            <Link key={action.id} to={action.to} style={style} className={className}>
              {inner}
            </Link>
          );
        })}
      </div>
    </section>
  );
};
