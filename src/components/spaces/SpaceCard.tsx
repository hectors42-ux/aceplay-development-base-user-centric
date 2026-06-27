import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { type MySpace, sportLabel } from "@/hooks/useMySpaces";

// NIVEL 1 · Card de club en Espacios: RESUMEN de mi actividad (N torneos · M
// escalerillas ACTIVOS del deporte activo). Sin badge "EN VIVO": un acento
// discreto si hay pendientes. Tap → NIVEL 2 (casa del club), no a una competencia.
export function SpaceCard({ space }: { space: MySpace }) {
  const brand = space.brandColor ?? undefined;
  const initials = space.initials ?? space.clubName.split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

  const active = space.competitions.filter((c) => !c.finished);
  const nTorneos = active.filter((c) => c.type === "tournament").length;
  const nLadders = active.filter((c) => c.type === "ladder").length;
  const parts: string[] = [];
  if (nTorneos) parts.push(`${nTorneos} ${nTorneos === 1 ? "torneo" : "torneos"}`);
  if (nLadders) parts.push(`${nLadders} ${nLadders === 1 ? "escalerilla" : "escalerillas"}`);
  const summary = parts.length ? `${parts.join(" · ")} ${active.length === 1 ? "activo" : "activos"}` : "Solo competencias pasadas";

  return (
    <Link
      to={`/clubes/${space.clubId}`}
      className="flex items-center gap-3 overflow-hidden rounded-3xl border border-border bg-card p-4 shadow-card transition-smooth hover:bg-muted/30"
      style={brand ? { borderTopWidth: 3, borderTopColor: brand } : undefined}
    >
      {space.logoUrl ? (
        <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl border border-border bg-white">
          <img src={space.logoUrl} alt="" aria-hidden className="h-full w-full object-contain" />
        </span>
      ) : (
        <span
          className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-sm font-black text-white"
          style={{ background: brand ?? "hsl(var(--muted))" }}
        >
          {initials}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-display text-base font-bold text-foreground">{space.clubName}</p>
          {space.pendingTotal > 0 && (
            <span aria-label="Tienes pendientes" className="h-2 w-2 shrink-0 rounded-full bg-action" />
          )}
        </div>
        <p className="truncate text-xs text-muted-foreground">{sportLabel(space.sport)} · {space.relation}</p>
        <p className="mt-1 truncate text-sm font-semibold text-foreground">
          {summary}
          {space.pendingTotal > 0 && <span className="ml-1 font-normal text-action">· {space.pendingTotal} pendiente{space.pendingTotal === 1 ? "" : "s"}</span>}
        </p>
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
    </Link>
  );
}
