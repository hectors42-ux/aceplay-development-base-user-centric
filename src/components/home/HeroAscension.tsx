import { ArrowUpRight, Crown } from "lucide-react";
import { Steps } from "@/components/arena";
import { useAscensionPath } from "@/hooks/useCancha";

// Camino de ascenso compacto, para integrar DENTRO del Arena Hero del Inicio.
// Regla de presentación (Addendum A): titular = ACCIÓN, subtexto = número (est_wins
// con "~"). Lee compute_ascension_path (no recalcula). Solo lectura.
export function HeroAscension({ nivel }: { nivel: number }) {
  const { data: p } = useAscensionPath();
  if (!p) return null;

  if (p.is_maxed) {
    return (
      <div>
        <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-skill">
          <Crown className="h-3.5 w-3.5" /> En lo más alto
        </p>
        <p className="mt-1 text-sm font-bold text-foreground">
          Estás en {p.current_category_label} · defiende tu corona
        </p>
        <Steps current={nivel} className="mt-2" />
      </div>
    );
  }

  return (
    <div>
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-skill">
        <ArrowUpRight className="h-3.5 w-3.5" /> Camino a {p.next_category_label}
      </p>
      <p className="mt-1 text-sm font-bold text-foreground">
        Gana ~{p.est_wins} {p.est_wins === 1 ? "desafío" : "desafíos"} y subes a {p.next_category_label}
      </p>
      <p className="text-xs text-muted-foreground">
        Faltan <span className="font-semibold text-foreground tabular-nums">{p.points_needed} pts</span> · {p.est_basis}
      </p>
      <Steps current={nivel} className="mt-2" />
    </div>
  );
}
