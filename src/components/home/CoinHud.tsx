import { Link } from "react-router-dom";
import { Flame, Coins } from "lucide-react";
import { useStreak } from "@/hooks/useEconomy";
import { useFichas } from "@/hooks/useFichas";
import { useAuth } from "@/components/providers/AuthProvider";
import { UserAvatar } from "@/components/avatar/UserAvatar";
import { cn } from "@/lib/utils";

interface CoinHudProps {
  /** Valor de rating/nivel (capa habilidad → volt). */
  rating?: number | string;
  className?: string;
}

// HUD superior (liquid glass): IDENTIDAD del usuario (avatar + nombre → Perfil) +
// RATING (volt, no se canjea) + PUNTOS/Fichas (oro → Tienda) + RACHA (naranja).
// Firewall visual: rating(volt) y fichas(oro) son capas distintas, nunca se mezclan.
export function CoinHud({ rating, className }: CoinHudProps) {
  const { profile } = useAuth();
  const { data: fichas } = useFichas();
  const { data: streak } = useStreak();
  const weeks = streak?.current_weeks ?? 0;
  const name = profile ? `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() : "";

  return (
    <div className={cn("glass-bar flex items-center gap-2 rounded-[22px] px-3 py-2", className)}>
      {/* Identidad: avatar + nombre del usuario → Perfil */}
      <Link to="/perfil" aria-label="Ir a mi perfil" className="mr-auto flex min-w-0 items-center gap-2">
        <span className="block h-8 w-8 shrink-0 overflow-hidden rounded-full ring-1 ring-skill/40">
          <UserAvatar
            kind={profile?.avatar_kind}
            look={profile?.avatar_look}
            url={profile?.avatar_url}
            name={name || "Socio"}
            className="h-8 w-8"
          />
        </span>
        <span className="truncate font-display text-sm font-bold text-foreground">{name || "Mi perfil"}</span>
      </Link>

      {/* RATING · skill (volt) — se oculta si no hay valor disponible */}
      {rating != null && rating !== "" && (
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-skill/10 px-2.5 py-1 text-sm font-extrabold text-skill" aria-label="Tu rating">
          <span className="grid h-5 w-5 place-items-center rounded-full bg-gradient-to-br from-skill to-[hsl(var(--skill-deep))] text-[9px] text-[hsl(var(--skill-foreground))]">◈</span>
          <span className="tabular-nums">{rating}</span>
        </span>
      )}

      {/* PUNTOS · fichas (oro) → Tienda */}
      <Link to="/tienda" aria-label="Tus Fichas · ir a la Tienda" className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-fichas/10 px-2.5 py-1 text-sm font-extrabold text-fichas transition-smooth hover:bg-fichas/20">
        <Coins className="h-4 w-4" />
        <span className="tabular-nums">{fichas?.balance ?? 0}</span>
      </Link>

      {/* RACHA (naranja) */}
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-action/30 bg-action/10 px-2 py-1 text-sm font-extrabold text-action" aria-label={`Racha ${weeks} semanas`}>
        <Flame className="h-4 w-4" />
        <span className="tabular-nums">{weeks}</span>
      </span>
    </div>
  );
}
