import { Link } from "react-router-dom";
import { ArrowUp, Check, Search, ListOrdered, Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/avatar/UserAvatar";
import { useReceivedChallenges, useMatchAgenda, useRespondChallenge } from "@/hooks/useCancha";
import { useMySpaces } from "@/hooks/useMySpaces";
import { formatSlot as fmtSlot } from "@/lib/cancha-utils";

// BLOQUE 2 · "TE TOCA": UNA sola acción, la de mayor prioridad según mi situación:
//   1. Cargar resultado (partido vencido sin resultado) — ORO (cierre de algo pendiente).
//   2. Aceptar invitación (reto pendiente) — NARANJA, acción directa (respond_challenge).
//   3. Retar siguiente (estoy en una escalerilla) — NARANJA → flujo de reto.
//   4. Buscar partner (nada de lo anterior) — NARANJA → /cancha/buscar.
// Solo lee y enruta/dispara M1; no escribe rating/xp/fichas.
export function TeToca() {
  const { data: agenda = [] } = useMatchAgenda();
  const { data: received = [] } = useReceivedChallenges();
  const { spaces } = useMySpaces();
  const respond = useRespondChallenge();

  const overdue = agenda.find((a) => a.state === "vencido_sin_resultado");
  const reto = received[0];
  const ladder = spaces.flatMap((s) => s.competitions).find((c) => c.type === "ladder" && !c.finished) as
    | { type: "ladder"; name: string; myRank: number | null }
    | undefined;

  // ── 1 · CARGAR RESULTADO (oro) ────────────────────────────────────────────
  if (overdue) {
    return (
      <section className="px-5" aria-label="Te toca · cargar resultado">
        <article className="rounded-3xl border border-fichas/40 bg-fichas/[0.06] p-5 shadow-card">
          <p className="mb-3 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-fichas">
            Te toca · cierra tu partido
          </p>
          <div className="flex items-center gap-3">
            <UserAvatar kind={overdue.opponent_avatar_kind} look={overdue.opponent_avatar_look} url={overdue.opponent_avatar_url} name={overdue.opponent_name ?? "Rival"} className="h-12 w-12 shrink-0" />
            <div className="min-w-0">
              <p className="truncate font-display text-base font-bold text-foreground">vs {overdue.opponent_name ?? "tu rival"}</p>
              <p className="truncate text-xs text-muted-foreground">{fmtSlot(overdue.slot)}{overdue.space_name ? ` · ${overdue.space_name}` : ""} · ¿quién ganó?</p>
            </div>
          </div>
          <Button asChild size="lg" className="mt-4 w-full gap-1 border border-fichas/40 bg-fichas text-[#211803] shadow-card hover:bg-fichas/90">
            <Link to={`/resultado/cargar/${overdue.ref_id}`}>Cargar resultado <ArrowUp className="h-4 w-4" /></Link>
          </Button>
        </article>
      </section>
    );
  }

  // ── 2 · ACEPTAR INVITACIÓN (naranja · acción directa) ─────────────────────
  if (reto) {
    return (
      <section className="px-5" aria-label="Te toca · acepta tu partido">
        <article className="rounded-3xl border border-action/40 bg-action/[0.06] p-5 shadow-card">
          <p className="mb-3 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-action">
            <Swords className="h-3.5 w-3.5" /> Te toca · acepta tu partido
          </p>
          <div className="flex items-center gap-3">
            <UserAvatar kind={reto.from_profile?.avatar_kind} look={reto.from_profile?.avatar_look} url={reto.from_profile?.avatar_url} name={reto.from_profile?.display_name ?? "Rival"} className="h-12 w-12 shrink-0" />
            <div className="min-w-0">
              <p className="truncate font-display text-base font-bold text-foreground">Acepta tu partido con {reto.from_profile?.display_name ?? "tu rival"}</p>
              <p className="truncate text-xs text-muted-foreground">Propone: {fmtSlot(reto.proposed_slots?.[0] ?? null)}{reto.space?.name ? ` · ${reto.space.name}` : ""}</p>
            </div>
          </div>
          <Button variant="clay" size="lg" className="mt-4 w-full gap-1" disabled={respond.isPending}
            onClick={() => respond.mutate({ id: reto.id, action: "accept", slot: reto.proposed_slots?.[0] ?? undefined })}>
            <Check className="h-4 w-4" /> Aceptar partido
          </Button>
        </article>
      </section>
    );
  }

  // ── 3 · RETAR SIGUIENTE (naranja · escalerilla) ───────────────────────────
  if (ladder) {
    return (
      <section className="px-5" aria-label="Te toca · sube en tu escalerilla">
        <Link to="/escalerilla" className="flex items-center gap-3 rounded-3xl border border-action/40 bg-action/[0.06] p-5 shadow-card transition-smooth hover:bg-action/10">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-action/15 text-action"><ListOrdered className="h-6 w-6" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-action">Te toca · sube de posición</p>
            <p className="truncate font-display text-base font-bold text-foreground">Reta al de arriba y sube</p>
            <p className="truncate text-xs text-muted-foreground">{ladder.name}{ladder.myRank ? ` · vas #${ladder.myRank}` : ""}</p>
          </div>
        </Link>
      </section>
    );
  }

  // ── 4 · BUSCAR PARTNER (naranja · fallback) ───────────────────────────────
  return (
    <section className="px-5" aria-label="Te toca · busca tu próximo partido">
      <Link to="/cancha/buscar" className="flex items-center gap-3 rounded-3xl border border-action/40 bg-action/[0.06] p-5 shadow-card transition-smooth hover:bg-action/10">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-action/15 text-action"><Search className="h-6 w-6" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-action">Te toca · encuentra rival</p>
          <p className="truncate font-display text-base font-bold text-foreground">Busca tu próximo partido</p>
          <p className="truncate text-xs text-muted-foreground">Encuentra un partner de tu nivel</p>
        </div>
      </Link>
    </section>
  );
}
