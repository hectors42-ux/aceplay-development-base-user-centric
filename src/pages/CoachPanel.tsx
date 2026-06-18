import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  ArrowLeft,
  GraduationCap,
  Calendar,
  CheckCircle2,
  XCircle,
  CircleDollarSign,
  Loader2,
  TrendingUp,
  Plus,
  CalendarDays,
} from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import { useMyCoachProfile } from "@/hooks/useCoaches";
import { useMyCoachClasses } from "@/hooks/useCoachClasses";
import { CoachCreateClassDialog } from "@/components/coach/CoachCreateClassDialog";
import { CoachWeekCalendar } from "@/components/coach/CoachWeekCalendar";
import { toast } from "sonner";

const CoachPanel = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const qc = useQueryClient();
  const { data: coachProfile, isLoading: loadingProfile } = useMyCoachProfile();
  const { data: classes = [], isLoading: loadingClasses } = useMyCoachClasses(
    coachProfile?.id,
  );
  const [tab, setTab] = useState<"agenda" | "calendario" | "historial" | "pagos">("agenda");
  const [createOpen, setCreateOpen] = useState(false);

  const now = new Date();
  const upcoming = classes.filter(
    (c) =>
      (c.status === "propuesta" || c.status === "confirmada") &&
      new Date(c.starts_at) >= new Date(now.getTime() - 60 * 60 * 1000),
  );
  const history = classes.filter(
    (c) =>
      c.status === "completada" ||
      c.status === "cancelada" ||
      (c.status === "confirmada" && new Date(c.ends_at) < now),
  );

  const stats = useMemo(() => {
    const completed = classes.filter((c) => c.status === "completada");
    const totalRevenue = completed.reduce((s, c) => s + (c.price_clp ?? 0), 0);
    const pending = completed.filter((c) => c.payment_status === "pendiente");
    const pendingRevenue = pending.reduce((s, c) => s + (c.price_clp ?? 0), 0);
    return {
      completedCount: completed.length,
      totalRevenue,
      pendingCount: pending.length,
      pendingRevenue,
      upcomingCount: upcoming.length,
    };
  }, [classes, upcoming.length]);

  const confirmClass = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("confirm_coach_class", { _class_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Clase confirmada");
      qc.invalidateQueries({ queryKey: ["my-coach-classes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const completeClass = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("complete_coach_class", { _class_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Clase marcada como completada · ELO actualizado");
      qc.invalidateQueries({ queryKey: ["my-coach-classes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelClass = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("cancel_coach_class", {
        _class_id: id,
        _reason: "Cancelada por el coach",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Clase cancelada");
      qc.invalidateQueries({ queryKey: ["my-coach-classes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const markPaid = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("mark_class_paid", {
        _class_id: id,
        _status: "pagada",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pago registrado");
      qc.invalidateQueries({ queryKey: ["my-coach-classes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (loadingProfile) {
    return (
      <div className="min-h-screen bg-background p-5">
        <Skeleton className="h-32 rounded-3xl" />
      </div>
    );
  }

  if (!coachProfile) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <AppHeader memberName={profile?.first_name ?? ""} greeting="Hola" />
        <div className="mx-auto max-w-md px-5 pt-10 text-center">
          <GraduationCap className="mx-auto h-12 w-12 text-muted-foreground/40" />
          <h2 className="mt-3 font-display text-xl font-semibold">No eres coach</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Esta sección es solo para instructores del club.
          </p>
          <Button onClick={() => navigate("/")} className="mt-4">
            Volver al inicio
          </Button>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <AppHeader memberName={profile?.first_name ?? ""} greeting="Panel coach" />

      <div className="mx-auto max-w-md space-y-4 px-5 pt-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="font-display text-2xl font-semibold">Mi panel</h1>
              <p className="text-sm text-muted-foreground">
                {coachProfile.is_head_coach ? "Head Coach" : "Instructor"}
              </p>
            </div>
          </div>
          <Button size="sm" variant="clay" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> Nueva clase
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          <StatCard label="Próximas" value={stats.upcomingCount} icon={Calendar} />
          <StatCard label="Completadas" value={stats.completedCount} icon={CheckCircle2} />
          <StatCard
            label="Por cobrar"
            value={`$${(stats.pendingRevenue / 1000).toFixed(0)}k`}
            icon={CircleDollarSign}
          />
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="agenda">Agenda</TabsTrigger>
            <TabsTrigger value="calendario">
              <CalendarDays className="mr-1 h-3.5 w-3.5" /> Cal
            </TabsTrigger>
            <TabsTrigger value="historial">Historial</TabsTrigger>
            <TabsTrigger value="pagos">Pagos</TabsTrigger>
          </TabsList>

          <TabsContent value="calendario" className="mt-3">
            {loadingClasses ? (
              <Skeleton className="h-[500px] rounded-2xl" />
            ) : (
              <CoachWeekCalendar classes={classes} />
            )}
          </TabsContent>


          <TabsContent value="agenda" className="mt-3 space-y-2">
            {loadingClasses ? (
              <Skeleton className="h-24 rounded-2xl" />
            ) : upcoming.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No tienes clases próximas.
              </p>
            ) : (
              upcoming.map((c) => (
                <ClassCard
                  key={c.id}
                  cls={c}
                  actions={
                    <div className="flex flex-wrap gap-2">
                      {c.status === "propuesta" && (
                        <Button
                          size="sm"
                          variant="clay"
                          onClick={() => confirmClass.mutate(c.id)}
                          disabled={confirmClass.isPending}
                        >
                          <CheckCircle2 className="h-4 w-4" /> Confirmar
                        </Button>
                      )}
                      {c.status === "confirmada" && (
                        <Button
                          size="sm"
                          variant="clay"
                          onClick={() => completeClass.mutate(c.id)}
                          disabled={completeClass.isPending}
                        >
                          {completeClass.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <TrendingUp className="h-4 w-4" />
                          )}{" "}
                          Completar
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => cancelClass.mutate(c.id)}
                      >
                        <XCircle className="h-4 w-4" /> Cancelar
                      </Button>
                    </div>
                  }
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="historial" className="mt-3 space-y-2">
            {history.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Sin historial aún.
              </p>
            ) : (
              history.map((c) => <ClassCard key={c.id} cls={c} />)
            )}
          </TabsContent>

          <TabsContent value="pagos" className="mt-3 space-y-2">
            {classes.filter((c) => c.status === "completada").length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No hay clases para cobrar.
              </p>
            ) : (
              classes
                .filter((c) => c.status === "completada")
                .map((c) => (
                  <ClassCard
                    key={c.id}
                    cls={c}
                    actions={
                      c.payment_status === "pendiente" ? (
                        <Button
                          size="sm"
                          variant="clay"
                          onClick={() => markPaid.mutate(c.id)}
                          disabled={markPaid.isPending}
                        >
                          <CircleDollarSign className="h-4 w-4" /> Marcar pagada
                        </Button>
                      ) : (
                        <Badge variant="default">Pagada</Badge>
                      )
                    }
                  />
                ))
            )}
          </TabsContent>
        </Tabs>
      </div>

      <BottomNav />

      <CoachCreateClassDialog
        coach={coachProfile}
        open={createOpen}
        onOpenChange={setCreateOpen}
      />
    </div>
  );
};

const StatCard = ({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: typeof Calendar;
}) => (
  <div className="rounded-2xl border border-border bg-card p-3 shadow-card">
    <Icon className="h-4 w-4 text-primary" />
    <p className="mt-1 font-display text-xl font-semibold leading-none">{value}</p>
    <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
      {label}
    </p>
  </div>
);

const ClassCard = ({
  cls,
  actions,
}: {
  cls: ReturnType<typeof useMyCoachClasses>["data"] extends (infer T)[] | undefined ? T : never;
  actions?: React.ReactNode;
}) => (
  <div className="rounded-2xl border border-border bg-card p-3 shadow-card">
    <div className="flex items-center justify-between">
      <div>
        <p className="font-display text-base font-semibold">
          {cls.student1_name ?? "Externo"}
          {cls.student2_name ? ` · ${cls.student2_name}` : ""}
        </p>
        <p className="text-xs text-muted-foreground">
          {format(new Date(cls.starts_at), "EEE d MMM, HH:mm", { locale: es })}
          {" · "}
          {cls.duration_minutes}min · {cls.court_name}
        </p>
      </div>
      <Badge
        variant={
          cls.status === "completada"
            ? "default"
            : cls.status === "cancelada"
              ? "destructive"
              : cls.status === "confirmada"
                ? "default"
                : "secondary"
        }
      >
        {cls.status}
      </Badge>
    </div>
    <div className="mt-2 flex items-center justify-between">
      <span className="text-sm font-semibold">
        ${cls.price_clp.toLocaleString("es-CL")}
      </span>
      {actions}
    </div>
  </div>
);

export default CoachPanel;
