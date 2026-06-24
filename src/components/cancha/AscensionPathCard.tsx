import { ArrowUpRight, Crown, ChevronRight } from "lucide-react";
import { Steps } from "@/components/arena";
import { Button } from "@/components/ui/button";
import { useAscensionPath } from "@/hooks/useCancha";

// Camino de ascenso (Addendum A · REGLA DE PRESENTACIÓN):
//   · Titular = ACCIÓN: "Gana ~2 desafíos y subes a Segunda".
//   · Subtexto = número de soporte: "faltan 45 pts · estimado vs rivales de tu Zona".
//   · est_wins SIEMPRE con "~" (es estimación); points_needed es cierto.
//   · CTA naranja → Conexión / Buscar partner (el camino EMPUJA al partido).
// Lee compute_ascension_path (M1); no recalcula nada.
export function AscensionPathCard({ nivel, onGoConexion }: { nivel: number; onGoConexion: () => void }) {
  const { data: path, isLoading } = useAscensionPath();

  if (isLoading || !path) {
    return <div className="h-28 animate-pulse rounded-[22px] border border-border bg-card/60" aria-hidden />;
  }

  const stepIndicator = `${Math.min(7, Math.max(0, Math.round(nivel)))}/7`;

  // Categoría tope: no hay siguiente escalón — se invita a defender la posición.
  if (path.is_maxed) {
    return (
      <section
        aria-label="Camino de ascenso"
        className="space-y-3 rounded-[22px] border border-skill/40 bg-card p-4 shadow-card ring-1 ring-skill/15"
      >
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-skill">
            <Crown className="h-3.5 w-3.5" /> En lo más alto
          </p>
          <span className="font-display text-sm font-bold tabular-nums text-skill">{stepIndicator}</span>
        </div>
        <Steps current={nivel} />
        <div>
          <p className="font-display text-lg font-bold leading-tight text-foreground">
            Estás en {path.current_category_label} · defiende tu corona
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Mantén el ritmo: juega y confirma resultados para no ceder posiciones.
          </p>
        </div>
        <Button variant="clay" size="lg" className="w-full gap-1" onClick={onGoConexion}>
          Buscar rival a tu altura <ChevronRight className="h-4 w-4" />
        </Button>
      </section>
    );
  }

  return (
    <section
      aria-label="Camino de ascenso"
      className="space-y-3 rounded-[22px] border border-skill/40 bg-card p-4 shadow-card ring-1 ring-skill/15"
    >
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-skill">
          <ArrowUpRight className="h-3.5 w-3.5" /> Camino a {path.next_category_label}
        </p>
        <span className="font-display text-sm font-bold tabular-nums text-skill">{stepIndicator}</span>
      </div>

      <Steps current={nivel} />

      <div>
        {/* Titular = ACCIÓN (est_wins con "~"). */}
        <p className="font-display text-lg font-bold leading-tight text-foreground">
          Gana ~{path.est_wins} {path.est_wins === 1 ? "desafío" : "desafíos"} y subes a {path.next_category_label}
        </p>
        {/* Subtexto = número de soporte (points_needed es cierto). */}
        <p className="mt-0.5 text-sm text-muted-foreground">
          Faltan <span className="font-semibold text-foreground tabular-nums">{path.points_needed} pts</span>
          {" · "}
          {path.est_basis}
        </p>
      </div>

      <Button variant="clay" size="lg" className="w-full gap-1" onClick={onGoConexion}>
        Buscar partner para subir <ChevronRight className="h-4 w-4" />
      </Button>
    </section>
  );
}
