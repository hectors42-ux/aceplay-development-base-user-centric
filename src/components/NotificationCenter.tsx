import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  Bell,
  CalendarCheck,
  CalendarClock,
  Check,
  CheckCheck,
  ClipboardList,
  GraduationCap,
  Handshake,
  Hourglass,
  Loader2,
  Megaphone,
  Send,
  Swords,
  Timer,
  Trophy,
  UserPlus,
  X,
  Trash2,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useNotificationsFeed, type NotificationKind } from "@/hooks/useNotificationsFeed";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { withRetry, friendlyErrorMessage } from "@/lib/notification-dismiss";
import { useBookingsProvider, openExternalBooking } from "@/hooks/useBookingsProvider";
import { EXTERNAL_BOOKING_COPY } from "@/lib/external-bookings-copy";
import { Badge } from "@/components/ui/badge";
import { ExternalLink } from "lucide-react";

const KIND_META: Record<NotificationKind, { Icon: typeof Bell; tone: string }> = {
  club_announcement: { Icon: Megaphone, tone: "text-primary" },
  result_proposal: { Icon: Trophy, tone: "text-amber-600 dark:text-amber-400" },
  result_to_load: { Icon: Trophy, tone: "text-amber-600 dark:text-amber-400" },
  reschedule_request: { Icon: CalendarClock, tone: "text-primary" },
  doubles_invitation: { Icon: UserPlus, tone: "text-emerald-600 dark:text-emerald-400" },
  admin_registration: { Icon: ClipboardList, tone: "text-violet-600 dark:text-violet-400" },
  ladder_challenge: { Icon: Swords, tone: "text-primary" },
  ladder_challenge_accepted: { Icon: CheckCheck, tone: "text-emerald-600 dark:text-emerald-400" },
  ladder_propose_slots: { Icon: Send, tone: "text-primary" },
  ladder_slots_proposed: { Icon: Hourglass, tone: "text-amber-600 dark:text-amber-400" },
  ladder_result_pending: { Icon: Timer, tone: "text-primary" },
  ladder_result: { Icon: CheckCheck, tone: "text-amber-600 dark:text-amber-400" },
  challenge_expired: { Icon: Timer, tone: "text-destructive" },
  booking_partner: { Icon: Handshake, tone: "text-emerald-600 dark:text-emerald-400" },
  match_acceptance: { Icon: CalendarCheck, tone: "text-primary" },
  class_invitation: { Icon: GraduationCap, tone: "text-violet-600 dark:text-violet-400" },
  partner_invitation: { Icon: UserPlus, tone: "text-primary" },
  partner_invitation_received: { Icon: UserPlus, tone: "text-primary" },
  partner_invitation_accepted: { Icon: CheckCheck, tone: "text-emerald-600 dark:text-emerald-400" },
  partner_invitation_rejected: { Icon: X, tone: "text-destructive" },
  partner_match_booked: { Icon: CalendarCheck, tone: "text-emerald-600 dark:text-emerald-400" },
  partner_match_cancelled: { Icon: X, tone: "text-destructive" },
  partner_match_reminder: { Icon: Bell, tone: "text-primary" },
  tournament_match_scheduled: { Icon: CalendarCheck, tone: "text-primary" },
  tournament_streak: { Icon: Trophy, tone: "text-amber-600 dark:text-amber-400" },
  tournament_champion: { Icon: Trophy, tone: "text-amber-500 dark:text-amber-300" },
};

// Notificaciones que NUNCA pueden eliminarse hasta resolverse (cualquier modo).
const STICKY_KINDS_ALWAYS = new Set<NotificationKind>([
  "result_to_load",
  "result_proposal",
]);
// Notificaciones que se vuelven sticky SOLO en modo de reservas externas
// (porque hay una acción pendiente: ir a EasyCancha a reservar).
const STICKY_KINDS_EXTERNAL_ONLY = new Set<NotificationKind>([
  "ladder_challenge_accepted",
  "partner_invitation_accepted",
]);

interface Props {
  triggerClassName?: string;
}

export const NotificationCenter = ({ triggerClassName }: Props) => {
  const { items, loading, total, refresh } = useNotificationsFeed();
  const { isExternal, externalUrl } = useBookingsProvider();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [confirmDismiss, setConfirmDismiss] = useState<
    { kind: string; ref_id: string; title: string } | null
  >(null);

  const isStickyKind = (kind: NotificationKind) =>
    STICKY_KINDS_ALWAYS.has(kind) ||
    (isExternal && STICKY_KINDS_EXTERNAL_ONLY.has(kind));

  // Reordenar: sticky primero, luego anuncios, luego por fecha desc
  const sortedItems = [...items].sort((a, b) => {
    const aSticky = isStickyKind(a.kind) ? 0 : 1;
    const bSticky = isStickyKind(b.kind) ? 0 : 1;
    if (aSticky !== bSticky) return aSticky - bSticky;
    return 0;
  });

  const dismissibleCount = items.filter((it) => !isStickyKind(it.kind)).length;

  const respondLadder = async (challengeId: string, accept: boolean) => {
    setBusyId(challengeId);
    const { error } = await supabase.rpc("respond_ladder_challenge", {
      _challenge_id: challengeId,
      _accept: accept,
    });
    setBusyId(null);
    if (error) {
      toast({
        title: "Error al responder",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    toast({ title: accept ? "Desafío aceptado" : "Desafío rechazado" });
    void refresh();
  };

  const acceptInvitation = async (registrationId: string) => {
    setBusyId(registrationId);
    const { error } = await supabase.rpc("accept_doubles_invitation", {
      _registration_id: registrationId,
    });
    setBusyId(null);
    if (error) {
      toast({
        title: "Error al aceptar",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Invitación aceptada" });
    void refresh();
  };

  // Reintentos automáticos y mensajes amigables se importan desde
  // "@/lib/notification-dismiss" para poder testearlos en aislamiento.


  const dismissNotification = async (kind: string, refId: string) => {
    setBusyId(refId);
    // 1) Si es challenge_expired, intenta borrar el registro de user_notifications (legacy)
    if (kind === "challenge_expired") {
      const legacy = await withRetry(
        () =>
          supabase
            .from("user_notifications")
            .delete()
            .eq("kind", kind)
            .eq("ref_id", refId)
            .then((r) => ({ error: r.error })),
        `delete user_notifications ${refId}`,
      );
      if (legacy.error) {
        // No bloqueamos el flujo: el upsert siguiente cubre la persistencia del descarte.
        console.warn("[notifications] limpieza legacy falló, continuamos con dismissal", legacy.error);
      }
    }
    // 2) Persistir descarte en notification_dismissals (sirve para cualquier kind)
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) {
      setBusyId(null);
      toast({
        title: "Sesión no encontrada",
        description: "Vuelve a iniciar sesión para eliminar notificaciones.",
        variant: "destructive",
      });
      return;
    }
    const result = await withRetry(
      () =>
        supabase
          .from("notification_dismissals")
          .upsert(
            { user_id: userId, kind, ref_id: refId },
            { onConflict: "user_id,kind,ref_id" },
          )
          .then((r) => ({ error: r.error })),
      `upsert dismissal ${kind}/${refId}`,
    );
    setBusyId(null);
    if (result.error) {
      toast({
        title: "No se pudo eliminar la notificación",
        description: `${friendlyErrorMessage(result.error)} (${result.attempts} intentos)`,
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Notificación eliminada" });
    void refresh();
  };

  const dismissAllVisible = async () => {
    // Las sticky no se eliminan masivamente
    const dismissableItems = items.filter((it) => !isStickyKind(it.kind));
    if (dismissableItems.length === 0) return;
    setClearing(true);
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) {
      setClearing(false);
      setConfirmClearOpen(false);
      toast({
        title: "Sesión no encontrada",
        description: "Vuelve a iniciar sesión para eliminar notificaciones.",
        variant: "destructive",
      });
      return;
    }
    const rows = dismissableItems.map((it) => ({
      user_id: userId,
      kind: it.kind,
      ref_id: it.ref_id,
    }));
    // Borrar legacy challenge_expired en user_notifications (no bloqueante)
    const expired = dismissableItems.filter((it) => it.kind === "challenge_expired");
    if (expired.length > 0) {
      const legacy = await withRetry(
        () =>
          supabase
            .from("user_notifications")
            .delete()
            .eq("kind", "challenge_expired")
            .in("ref_id", expired.map((e) => e.ref_id))
            .then((r) => ({ error: r.error })),
        `bulk delete user_notifications (${expired.length})`,
      );
      if (legacy.error) {
        console.warn("[notifications] limpieza legacy en lote falló", legacy.error);
      }
    }
    const result = await withRetry(
      () =>
        supabase
          .from("notification_dismissals")
          .upsert(rows, { onConflict: "user_id,kind,ref_id" })
          .then((r) => ({ error: r.error })),
      `bulk upsert dismissals (${rows.length})`,
    );
    setClearing(false);
    setConfirmClearOpen(false);
    if (result.error) {
      toast({
        title: "No se pudieron eliminar todas las notificaciones",
        description: `${friendlyErrorMessage(result.error)} (${result.attempts} intentos)`,
        variant: "destructive",
      });
      return;
    }
    toast({
      title: `${rows.length} notificación${rows.length === 1 ? "" : "es"} eliminada${rows.length === 1 ? "" : "s"}`,
    });
    void refresh();
  };


  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Notificaciones${total > 0 ? `, ${total} pendientes` : ""}`}
          className={cn(
            "relative flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-card text-foreground transition-smooth hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            triggerClassName,
          )}
        >
          <Bell className="h-5 w-5" strokeWidth={2} />
          {total > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold leading-none text-destructive-foreground ring-2 ring-background">
              {total > 9 ? "9+" : total}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        collisionPadding={12}
        className="w-[calc(100vw-1.5rem)] max-w-[22rem] p-0"
      >
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <p className="font-display text-sm font-semibold">Notificaciones</p>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground">
              {loading ? "Actualizando…" : total === 0 ? "Al día" : `${total} pendientes`}
            </span>
            {dismissibleCount > 0 && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-[11px] text-muted-foreground hover:text-destructive"
                onClick={() => setConfirmClearOpen(true)}
                aria-label="Eliminar todas las notificaciones visibles"
              >
                <Trash2 className="mr-1 h-3 w-3" /> Eliminar todas
              </Button>
            )}
          </div>
        </div>
        <ScrollArea className="h-[min(70vh,28rem)]">
          {loading && items.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-10 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
              <CheckCheck className="h-8 w-8 text-success" strokeWidth={1.5} />
              <p className="text-sm font-medium">No tienes acciones pendientes</p>
              <p className="text-xs text-muted-foreground">
                Te avisaremos aquí cuando haya algo por responder.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {sortedItems.map((it) => {
                let meta = KIND_META[it.kind];
                if (!meta) {
                  console.warn("[NotificationCenter] kind no mapeado", {
                    kind: it.kind,
                    ref_id: it.ref_id,
                    title: it.title,
                    link: it.link,
                  });
                  meta = { Icon: Bell, tone: "text-muted-foreground" };
                }
                const Icon = meta.Icon;
                const isLadder = it.kind === "ladder_challenge";
                const isInvitation = it.kind === "doubles_invitation";
                const sticky = isStickyKind(it.kind);
                // En modo externo, las notificaciones de "aceptado" muestran CTA EasyCancha
                const showExternalBookCTA =
                  isExternal &&
                  (it.kind === "ladder_challenge_accepted" ||
                    it.kind === "partner_invitation_accepted");

                return (
                  <li key={`${it.kind}-${it.ref_id}`} className="px-4 py-3">
                    <div className="flex items-start gap-3">
                      <span
                        className={cn(
                          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-muted",
                          meta.tone,
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium leading-tight">{it.title}</p>
                          {sticky && (
                            <Badge
                              variant="outline"
                              className="shrink-0 border-amber-300/60 bg-amber-50 text-[9px] font-semibold uppercase tracking-wider text-amber-700 dark:border-amber-400/40 dark:bg-amber-950/40 dark:text-amber-300"
                            >
                              Acción requerida
                            </Badge>
                          )}
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                          {it.description}
                        </p>
                        <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground/70">
                          {it.created_at
                            ? formatDistanceToNow(parseISO(it.created_at), {
                                locale: es,
                                addSuffix: true,
                              })
                            : ""}
                        </p>
                      </div>
                    </div>

                    <div className="mt-2 flex items-center gap-2 pl-11">
                      {showExternalBookCTA && (
                        <Button
                          size="sm"
                          variant="clay"
                          className="h-7 px-2 text-xs"
                          onClick={() => {
                            openExternalBooking(externalUrl);
                            void supabase.from("analytics_events").insert({
                              event_name: "external_booking_opened",
                              event_props: {
                                source: "notif",
                                match_kind: it.kind,
                                ref_id: it.ref_id,
                              },
                            } as never);
                          }}
                        >
                          <ExternalLink className="mr-1 h-3 w-3" />
                          {EXTERNAL_BOOKING_COPY.cta}
                        </Button>
                      )}
                      {it.kind === "club_announcement" && (
                        <Button
                          size="sm"
                          variant="clay"
                          className="h-7 px-2 text-xs"
                          disabled={busyId === it.ref_id}
                          onClick={async () => {
                            await dismissNotification(it.kind, it.ref_id);
                            if (it.link) {
                              setOpen(false);
                              if (/^https?:\/\//i.test(it.link)) {
                                window.open(it.link, "_blank", "noopener,noreferrer");
                              } else {
                                navigate(it.link);
                              }
                            }
                          }}
                        >
                          {busyId === it.ref_id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : it.link ? (
                            "Ver detalle"
                          ) : (
                            "Marcar como leído"
                          )}
                        </Button>
                      )}
                      {isLadder && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 flex-1 px-2 text-xs"
                            disabled={busyId === it.ref_id}
                            onClick={() => respondLadder(it.ref_id, false)}
                          >
                            {busyId === it.ref_id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <>
                                <X className="h-3 w-3" /> Rechazar
                              </>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="clay"
                            className="h-7 flex-1 px-2 text-xs"
                            disabled={busyId === it.ref_id}
                            onClick={() => respondLadder(it.ref_id, true)}
                          >
                            {busyId === it.ref_id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <>
                                <Check className="h-3 w-3" /> Aceptar
                              </>
                            )}
                          </Button>
                        </>
                      )}
                      {isInvitation && (
                        <Button
                          size="sm"
                          variant="clay"
                          className="h-7 flex-1 px-2 text-xs"
                          disabled={busyId === it.ref_id}
                          onClick={() => acceptInvitation(it.ref_id)}
                        >
                          {busyId === it.ref_id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <>
                              <Check className="h-3 w-3" /> Aceptar
                            </>
                          )}
                        </Button>
                      )}
                      {it.link && it.kind !== "club_announcement" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => {
                            setOpen(false);
                            navigate(it.link);
                          }}
                        >
                          Ver detalle
                        </Button>
                      )}
                      {!sticky && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="ml-auto h-7 w-7 px-0 text-muted-foreground hover:text-destructive"
                          disabled={busyId === it.ref_id}
                          onClick={() =>
                            setConfirmDismiss({ kind: it.kind, ref_id: it.ref_id, title: it.title })
                          }
                          aria-label="Eliminar notificación"
                        >
                          {busyId === it.ref_id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>

      <AlertDialog open={confirmClearOpen} onOpenChange={setConfirmClearOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar todas las notificaciones?</AlertDialogTitle>
            <AlertDialogDescription>
              Se ocultarán las {dismissibleCount} notificacion{dismissibleCount === 1 ? "" : "es"} visibles. Las acciones que requieren respuesta (carga o confirmación de resultados, coordinación de partidos aceptados) seguirán visibles hasta resolverse.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={clearing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={clearing}
              onClick={(e) => {
                e.preventDefault();
                void dismissAllVisible();
              }}
            >
              {clearing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Eliminando…
                </>
              ) : (
                "Eliminar todas"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={!!confirmDismiss}
        onOpenChange={(o) => !o && !busyId && setConfirmDismiss(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta notificación?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDismiss?.title
                ? `Se ocultará "${confirmDismiss.title}" de tu bandeja. La acción asociada (si la hay) seguirá disponible en su sección.`
                : "Se ocultará de tu bandeja. La acción asociada seguirá disponible en su sección."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!busyId}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={!!busyId}
              onClick={async (e) => {
                e.preventDefault();
                if (!confirmDismiss) return;
                const target = confirmDismiss;
                await dismissNotification(target.kind, target.ref_id);
                setConfirmDismiss(null);
              }}
            >
              {busyId === confirmDismiss?.ref_id ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Eliminando…
                </>
              ) : (
                "Eliminar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Popover>
  );
};
