import { useState } from "react";
import { Bell, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTournamentAlert } from "@/hooks/useTournamentAlert";
import { toast } from "sonner";

export function UpcomingEmptyAlertCard() {
  const { subscribed, subscribe, loading } = useTournamentAlert();
  const [pending, setPending] = useState(false);

  const handle = async () => {
    setPending(true);
    const ok = await subscribe();
    setPending(false);
    if (ok) toast.success("Te avisaremos", { description: "Cuando se abran nuevas inscripciones recibirás una notificación." });
    else toast.error("No pudimos suscribirte. Intenta de nuevo.");
  };

  return (
    <div className="rounded-3xl border border-dashed border-border bg-card/50 p-6 text-center">
      <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <Bell className="h-5 w-5" />
      </div>
      <h3 className="font-display text-base font-semibold">Sin torneos próximos</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        No hay torneos próximos en agenda. Te avisaremos cuando se abran inscripciones.
      </p>
      <Button
        size="sm"
        variant={subscribed ? "outline" : "default"}
        className="mt-3"
        onClick={handle}
        disabled={loading || pending || subscribed}
      >
        {subscribed ? (
          <>
            <Check className="mr-1 h-3.5 w-3.5" />
            Suscrito
          </>
        ) : (
          <>
            <Bell className="mr-1 h-3.5 w-3.5" />
            Avísame
          </>
        )}
      </Button>
    </div>
  );
}
