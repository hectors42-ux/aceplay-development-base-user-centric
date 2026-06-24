import { Link } from "react-router-dom";
import { ChevronLeft, Clock, MapPin, ArrowUp, Check, Trophy } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/avatar/UserAvatar";
import { useMatchAgenda, type AgendaItem } from "@/hooks/useCancha";
import { formatSlot } from "@/lib/cancha-utils";
import { cn } from "@/lib/utils";

const STATE: Record<string, { label: string; cls: string }> = {
  por_jugar: { label: "Por jugar", cls: "text-info border-info/30 bg-info/10" },
  vencido_sin_resultado: { label: "Por cargar", cls: "text-fichas border-fichas/30 bg-fichas/10" },
  por_confirmar: { label: "Por confirmar", cls: "text-action border-action/30 bg-action/10" },
  confirmado: { label: "Confirmado", cls: "text-verde border-verde/30 bg-verde/10" },
};

// Orden de urgencia: lo accionable primero.
const ORDER = ["vencido_sin_resultado", "por_confirmar", "por_jugar", "confirmado"];

const AgendaCardCta = ({ a }: { a: AgendaItem }) => {
  if (a.state === "vencido_sin_resultado") {
    return (
      <Button asChild size="sm" className="gap-1 border border-fichas/40 bg-fichas text-[#211803] hover:bg-fichas/90">
        <Link to={`/resultado/cargar/${a.ref_id}`}>Cargar resultado <ArrowUp className="h-4 w-4" /></Link>
      </Button>
    );
  }
  if (a.state === "por_confirmar" && a.match_id) {
    return (
      <Button asChild variant="clay" size="sm" className="gap-1">
        <Link to={`/resultado-pendiente/${a.match_id}`}>Confirmar <Check className="h-4 w-4" /></Link>
      </Button>
    );
  }
  if (a.state === "confirmado" && a.match_id) {
    return (
      <Button asChild variant="outline" size="sm" className="gap-1">
        <Link to={`/victoria/${a.match_id}`}><Trophy className="h-4 w-4" /> Badge</Link>
      </Button>
    );
  }
  return null;
};

const Agenda = () => {
  const { data: agenda = [], isLoading } = useMatchAgenda();
  const sorted = [...agenda].sort((a, b) => ORDER.indexOf(a.state) - ORDER.indexOf(b.state));

  return (
    <div className="min-h-screen bg-background">
      <header className="safe-top sticky top-0 z-30 bg-background/80 px-5 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center gap-2">
          <Link to="/cancha" aria-label="Volver" className="grid h-9 w-9 place-items-center rounded-full hover:bg-muted">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h1 className="font-display text-lg font-bold tracking-tight text-foreground">Tu agenda</h1>
        </div>
      </header>

      <main className="mx-auto max-w-md space-y-3 px-5 pb-28 pt-2">
        {isLoading && <div className="h-28 animate-pulse rounded-2xl border border-border bg-card/60" aria-hidden />}
        {!isLoading && sorted.length === 0 && (
          <p className="rounded-2xl border border-border bg-card/60 px-4 py-8 text-center text-sm text-muted-foreground">
            No tienes partidos agendados. Acepta un reto o toma un llamado para empezar.
          </p>
        )}

        {sorted.map((a) => {
          const st = STATE[a.state] ?? STATE.por_jugar;
          return (
            <article key={`${a.kind}-${a.ref_id}`} className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-card">
              <div className="flex items-center gap-3">
                <UserAvatar kind={a.opponent_avatar_kind} look={a.opponent_avatar_look} url={a.opponent_avatar_url} name={a.opponent_name ?? "Rival"} className="h-11 w-11 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-sm font-bold text-foreground">vs {a.opponent_name ?? "rival"}</p>
                  <p className="flex items-center gap-2 truncate text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatSlot(a.slot)}</span>
                    <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{a.space_name ?? (a.kind === "escalerilla" ? "Escalerilla" : "Reto")}</span>
                  </p>
                </div>
                <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase", st.cls)}>{st.label}</span>
              </div>
              <div className="flex justify-end">
                <AgendaCardCta a={a} />
              </div>
            </article>
          );
        })}
        {/* [Addendum B] Sin sección de torneos: se suma al cablear la vitrina. */}
      </main>

      <BottomNav />
    </div>
  );
};

export default Agenda;
