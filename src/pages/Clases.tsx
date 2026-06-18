import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, GraduationCap, Star, Award, Languages, Clock } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/components/providers/AuthProvider";
import { useActiveSport } from "@/components/providers/SportProvider";
import { useCoaches, type CoachWithProfile } from "@/hooks/useCoaches";
import { useMyStudentClasses } from "@/hooks/useCoachClasses";
import { TakeClassDialog } from "@/components/coach/TakeClassDialog";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const Clases = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { sport } = useActiveSport();
  const { data: coaches = [], isLoading } = useCoaches();
  const { data: myClasses = [] } = useMyStudentClasses();
  const [selectedCoach, setSelectedCoach] = useState<CoachWithProfile | null>(null);

  const upcoming = myClasses.filter(
    (c) => c.status === "propuesta" || c.status === "confirmada",
  );

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Buenos días";
    if (h < 19) return "Buenas tardes";
    return "Buenas noches";
  })();

  return (
    <div className="min-h-screen bg-background pb-24">
      <AppHeader memberName={profile?.first_name ?? ""} greeting={greeting} interactive={false} />

      <div className="mx-auto max-w-md space-y-5 px-5 pt-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="font-display text-2xl font-semibold">
              Tomar clase {sport === "padel" ? "de pádel" : "de tenis"}
            </h1>
            <p className="text-sm text-muted-foreground">
              Elige tu instructor y horario
            </p>
          </div>
        </div>

        {upcoming.length > 0 && (
          <section className="rounded-3xl border border-border bg-card p-4 shadow-card">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Próximas clases
            </h2>
            <ul className="space-y-2">
              {upcoming.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center gap-3 rounded-2xl bg-muted/30 p-3"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <GraduationCap className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{c.coach_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(c.starts_at), "EEE d MMM, HH:mm", { locale: es })}
                      {" · "}
                      {c.court_name}
                    </p>
                  </div>
                  <Badge variant={c.status === "confirmada" ? "default" : "secondary"}>
                    {c.status === "confirmada" ? "Confirmada" : "Por confirmar"}
                  </Badge>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Coaches de {sport === "padel" ? "pádel" : "tenis"} del club
          </h2>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-32 rounded-3xl" />
              ))}
            </div>
          ) : coaches.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border p-8 text-center">
              <GraduationCap className="mx-auto h-10 w-10 text-muted-foreground/40" />
              <p className="mt-3 text-sm font-medium">
                Aún no hay coaches de {sport === "padel" ? "pádel" : "tenis"} disponibles.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Cambia de deporte en el header o vuelve más tarde.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {coaches.map((coach) => (
                <article
                  key={coach.id}
                  className="rounded-3xl border border-border bg-card p-4 shadow-card"
                >
                  <div className="flex gap-3">
                    <Avatar className="h-16 w-16 border-2 border-primary/20">
                      <AvatarImage
                        src={coach.photo_url ?? coach.profile?.avatar_url ?? undefined}
                      />
                      <AvatarFallback>
                        {coach.profile?.first_name?.[0]}
                        {coach.profile?.last_name?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-display text-lg font-semibold">
                          {coach.profile?.first_name} {coach.profile?.last_name}
                        </h3>
                        {coach.is_head_coach && (
                          <Badge className="bg-gradient-clay text-primary-foreground">
                            <Star className="mr-1 h-3 w-3" /> Head
                          </Badge>
                        )}
                        {coach.sports?.includes("padel") && coach.sports?.includes("tenis") && (
                          <Badge variant="outline" className="text-[10px]">Tenis + Pádel</Badge>
                        )}
                        {coach.sports?.length === 1 && coach.sports[0] === "padel" && (
                          <Badge variant="outline" className="text-[10px] border-accent text-accent-foreground">Pádel</Badge>
                        )}
                      </div>
                      {coach.bio_pro && (
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                          {coach.bio_pro}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-1">
                        {coach.specialties?.slice(0, 3).map((s) => (
                          <Badge key={s} variant="secondary" className="text-[10px]">
                            {s}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-border pt-3 text-xs text-muted-foreground">
                    {coach.years_coaching ? (
                      <span className="flex items-center gap-1">
                        <Award className="h-3.5 w-3.5" />
                        {coach.years_coaching} años
                      </span>
                    ) : null}
                    {coach.languages?.length ? (
                      <span className="flex items-center gap-1">
                        <Languages className="h-3.5 w-3.5" />
                        {coach.languages.join(", ")}
                      </span>
                    ) : null}
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      desde ${coach.hourly_rate_member_clp.toLocaleString("es-CL")}/h
                    </span>
                  </div>

                  <Button
                    onClick={() => setSelectedCoach(coach)}
                    variant="clay"
                    className="mt-3 w-full"
                  >
                    Tomar clase
                  </Button>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      <TakeClassDialog
        coach={selectedCoach}
        open={!!selectedCoach}
        onOpenChange={(o) => !o && setSelectedCoach(null)}
      />

      <BottomNav />
    </div>
  );
};

export default Clases;
