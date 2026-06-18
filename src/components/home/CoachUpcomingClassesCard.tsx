import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { GraduationCap, ArrowRight, User as UserIcon, Users, UserPlus } from "lucide-react";
import { useMyCoachClasses } from "@/hooks/useCoachClasses";
import { useMyCoachProfile } from "@/hooks/useCoaches";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { AddToCalendarButton } from "@/components/shared/AddToCalendarButton";

export const CoachUpcomingClassesCard = () => {
  const navigate = useNavigate();
  const { data: coachProfile, isLoading: loadingProfile } = useMyCoachProfile();
  const { data: classes = [], isLoading } = useMyCoachClasses(coachProfile?.id);

  // Solo se muestra si el usuario es coach
  if (!loadingProfile && !coachProfile) return null;

  const now = new Date();
  const upcoming = classes
    .filter(
      (c) =>
        (c.status === "propuesta" || c.status === "confirmada") &&
        new Date(c.starts_at) >= new Date(now.getTime() - 60 * 60 * 1000),
    )
    .slice(0, 3);

  if (loadingProfile || isLoading) {
    return (
      <div className="mx-5">
        <Skeleton className="h-32 rounded-3xl" />
      </div>
    );
  }

  return (
    <div className="mx-5">
      <div
        role="button"
        tabIndex={0}
        onClick={() => navigate("/coach")}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            navigate("/coach");
          }
        }}
        className="group w-full cursor-pointer rounded-3xl border border-border bg-card p-4 text-left shadow-card transition-smooth hover:border-primary/40 hover:shadow-md"
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-2xl bg-primary/10">
              <GraduationCap className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-display text-sm font-semibold">Mis próximas clases</p>
              <p className="text-[11px] text-muted-foreground">
                {upcoming.length === 0 ? "Sin clases próximas" : `${upcoming.length} agendada${upcoming.length === 1 ? "" : "s"}`}
              </p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground transition-smooth group-hover:translate-x-0.5 group-hover:text-primary" />
        </div>

        {upcoming.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">
            Toca para abrir tu agenda y crear una clase nueva.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {upcoming.map((c) => {
              const Icon =
                c.kind === "externa" ? UserPlus : c.kind === "socio_compartida" ? Users : UserIcon;
              const studentLabel = `${c.student1_name ?? "Externo"}${c.student2_name ? ` + ${c.student2_name}` : ""}`;
              return (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-2 rounded-xl bg-muted/40 px-3 py-2 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">
                      <Icon className="mr-1 inline h-3 w-3 text-primary" />
                      {studentLabel}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {format(new Date(c.starts_at), "EEE d MMM, HH:mm", { locale: es })} ·{" "}
                      {c.court_name}
                    </p>
                  </div>
                  <div
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                    className="shrink-0"
                  >
                    <AddToCalendarButton
                      title={`Clase · ${studentLabel}`}
                      description={`Clase ${c.kind} en ${c.court_name}`}
                      location={c.court_name}
                      startsAt={c.starts_at}
                      endsAt={c.ends_at}
                      filename={`clase-${c.id}.ics`}
                      variant="ghost"
                      label=""
                      className="h-7 w-7 p-0"
                    />
                  </div>
                  <Badge
                    variant={c.status === "confirmada" ? "default" : "secondary"}
                    className={cn(
                      "shrink-0 text-[10px]",
                      c.status === "propuesta" && "bg-amber-500/15 text-amber-700 dark:text-amber-400",
                    )}
                  >
                    {c.status}
                  </Badge>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};
