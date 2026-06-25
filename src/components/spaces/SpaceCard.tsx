import { Link } from "react-router-dom";
import { ListOrdered, Trophy, ChevronRight } from "lucide-react";
import { type MySpace, sportLabel } from "@/hooks/useMySpaces";

// Tarjeta de "espacio" = un club con su estado competitivo en vivo. Identidad arriba
// + LiveBadge; UNA FILA POR COMPETENCIA dentro de la misma tarjeta. Tap por fila →
// detalle existente (su escalera / su cuadro). Colores: volt=mi posición,
// naranja=pendientes, oro=torneo/próximo.
export function SpaceCard({ space }: { space: MySpace }) {
  const brand = space.brandColor ?? undefined;
  const initials = space.initials ?? space.clubName.split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
  return (
    <article
      className="overflow-hidden rounded-3xl border border-border bg-card shadow-card"
      // Acento de marca del club: borde superior en su color primario.
      style={brand ? { borderTopWidth: 3, borderTopColor: brand } : undefined}
    >
      {/* Identidad del club */}
      <div className="flex items-center gap-3 p-4">
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
          <p className="truncate font-display text-base font-bold text-foreground">{space.clubName}</p>
          <p className="text-xs text-muted-foreground">
            {sportLabel(space.sport)} · {space.relation}
          </p>
        </div>
        {space.live && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-action/40 bg-action/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-action">
            <span className="h-1.5 w-1.5 rounded-full bg-action motion-safe:animate-pulse" /> En vivo
          </span>
        )}
      </div>

      {/* Una fila por competencia */}
      <div className="divide-y divide-border/60 border-t border-border/60">
        {space.competitions.map((c) =>
          c.type === "ladder" ? (
            <Link
              key={`l-${c.spaceId}`}
              to={c.route}
              className="flex items-center gap-3 px-4 py-3 transition-smooth hover:bg-muted/40"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-skill/10 text-skill">
                <ListOrdered className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">
                  Escalerilla · vas <span className="text-skill">#{c.myRank ?? "—"}</span>
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {c.pending > 0 ? `${c.pending} ${c.pending === 1 ? "desafío pendiente" : "desafíos pendientes"}` : "sin pendientes"}
                </p>
              </div>
              {c.pending > 0 ? (
                <span className="grid h-6 min-w-6 shrink-0 place-items-center rounded-full bg-action px-1.5 text-xs font-bold text-action-foreground">
                  {c.pending}
                </span>
              ) : (
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
            </Link>
          ) : (
            <Link
              key={`t-${c.categoryId}`}
              to={c.route}
              className="flex items-center gap-3 px-4 py-3 transition-smooth hover:bg-muted/40"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-fichas/10 text-fichas">
                <Trophy className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">
                  Torneo de {sportLabel(c.sport).toLowerCase()} · <span className="text-fichas">{c.phase}</span>
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {c.hasNext ? "Tienes tu próximo partido" : "Sigue tu cuadro"}
                </p>
              </div>
              {c.hasNext ? (
                <span className="shrink-0 rounded-full border border-fichas/40 bg-fichas/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-fichas">
                  Próx
                </span>
              ) : (
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
            </Link>
          ),
        )}
      </div>
    </article>
  );
}
