import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useCompactViewport } from "@/hooks/use-compact-viewport";
import { Target, Clock, Activity, History, Cake, Layers, Info } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { PartnerSuggestion, FitBreakdown } from "@/hooks/usePartnerSuggestions";
import { FitBreakdownSheet } from "./FitBreakdownSheet";

const initials = (a?: string | null, b?: string | null) =>
  `${a?.[0] ?? ""}${b?.[0] ?? ""}`.toUpperCase() || "?";

const BAR_COLORS = (v: number) =>
  v >= 75 ? "bg-success" : v >= 50 ? "bg-primary" : "bg-warning";

interface RowDef {
  key: keyof Omit<FitBreakdown, "score">;
  label: string;
  Icon: LucideIcon;
}

const ROWS: RowDef[] = [
  { key: "nivel",      label: "Nivel",      Icon: Target },
  { key: "horarios",   label: "Horarios",   Icon: Clock },
  { key: "frecuencia", label: "Frecuencia", Icon: Activity },
  { key: "historial",  label: "Historial",  Icon: History },
  { key: "edad",       label: "Edad",       Icon: Cake },
  { key: "superficie", label: "Superficie", Icon: Layers },
];

interface Props {
  partner: PartnerSuggestion;
  commonSlots?: string[];
}

/**
 * Tarjeta ink-dark con halo arcilla, FitRing grande y breakdown vertical
 * (label arriba + barra full-width + hint a la derecha) — sin solapamientos.
 */
export const PartnerMatchCard = ({ partner, commonSlots = [] }: Props) => {
  const compact = useCompactViewport();
  const [sheetOpen, setSheetOpen] = useState(false);
  const score = partner.compat_score ?? partner.breakdown?.score ?? 0;
  const ring = compact ? 68 : 84;
  const r = (ring - 6) / 2;
  const c = 2 * Math.PI * r;
  const dash = (Math.max(0, Math.min(100, score)) / 100) * c;

  const bd = partner.breakdown;
  const visibleRows = compact ? ROWS.slice(0, 4) : ROWS;
  // Filtra filas sin valor (ej. superficie cuando el club tiene 1 sola)
  const rows = visibleRows.filter((r) => bd?.[r.key]?.value != null);

  return (
    <>
      <div
        className={`relative overflow-hidden rounded-3xl border border-border/40 bg-[hsl(var(--ink-dark))] ${compact ? "p-3" : "p-4"} text-[hsl(var(--cream-0))] shadow-2xl`}
      >
        {/* Halo radial arcilla */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 50% 30%, hsl(var(--primary) / 0.35) 0%, transparent 60%)",
          }}
        />

        <div className="relative">
          {/* Header con avatar + ring lateral */}
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12 ring-2 ring-primary/40 ring-offset-2 ring-offset-[hsl(var(--ink-dark))]">
              <AvatarImage src={partner.avatar_url ?? undefined} />
              <AvatarFallback className="bg-[hsl(var(--cream-2))] text-[hsl(var(--ink-dark))]">
                {initials(partner.first_name, partner.last_name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className={`truncate font-display font-semibold leading-tight tracking-tight ${compact ? "text-lg" : "text-xl"}`}>
                {partner.first_name} {partner.last_name}
              </p>
              <p className={`mt-0.5 font-medium text-[hsl(var(--cream-0))]/70 ${compact ? "text-[12px]" : "text-[13px]"}`}>
                UTR {partner.level?.toFixed(2) ?? "—"}
                {partner.level_diff != null && ` · Δ ${partner.level_diff.toFixed(2)}`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="relative shrink-0 group"
              style={{ width: ring, height: ring }}
              aria-label="Ver desglose de fit"
            >
              <svg width={ring} height={ring} className="-rotate-90">
                <circle cx={ring / 2} cy={ring / 2} r={r} fill="none" strokeWidth={4} className="stroke-[hsl(var(--cream-0))]/15" />
                <circle
                  cx={ring / 2}
                  cy={ring / 2}
                  r={r}
                  fill="none"
                  strokeWidth={4}
                  strokeLinecap="round"
                  strokeDasharray={`${dash} ${c - dash}`}
                  className="stroke-primary transition-all"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
                <span className={`font-display ${compact ? "text-xl" : "text-2xl"} font-semibold text-primary`}>
                  {Math.round(score)}
                </span>
                <span className="text-[8px] uppercase tracking-[0.2em] text-[hsl(var(--cream-0))]/60">
                  fit
                </span>
              </div>
              <Info className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 text-primary/70 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          </div>

          {/* Breakdown vertical: cada fila = [icon label · hint] arriba, barra abajo */}
          <div className={`${compact ? "mt-3 space-y-2" : "mt-4 space-y-2.5"}`}>
            {rows.map(({ key, label, Icon }) => {
              const sig = bd?.[key];
              const value = sig?.value ?? 0;
              return (
                <div key={key} className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Icon className="h-3 w-3 text-[hsl(var(--cream-0))]/70 shrink-0" />
                      <span className="text-[10px] uppercase tracking-wider text-[hsl(var(--cream-0))]/70">
                        {label}
                      </span>
                    </div>
                    <span className="text-[10px] text-[hsl(var(--cream-0))]/70 truncate max-w-[55%] text-right">
                      {sig?.hint ?? "—"}
                    </span>
                  </div>
                  <div className="h-1 overflow-hidden rounded-full bg-[hsl(var(--cream-0))]/15">
                    <div className={`h-full ${BAR_COLORS(value)} transition-all`} style={{ width: `${value}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Horarios en común */}
          {commonSlots.length > 0 && (
            <div className={compact ? "mt-3" : "mt-4"}>
              <p className="mb-1.5 text-[10px] uppercase tracking-wider text-[hsl(var(--cream-0))]/60">
                Horarios en común
              </p>
              <div className="flex flex-wrap gap-1">
                {commonSlots.slice(0, compact ? 3 : 4).map((s) => (
                  <span
                    key={s}
                    className="rounded-full border border-primary/40 bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-[hsl(var(--cream-0))]"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <FitBreakdownSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        breakdown={bd}
        partnerName={`${partner.first_name ?? ""} ${partner.last_name ?? ""}`.trim() || "el jugador"}
        score={Math.round(score)}
      />
    </>
  );
};
