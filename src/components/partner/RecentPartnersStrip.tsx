import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useRecentPartners, type RecentPartner } from "@/hooks/useRecentPartners";

const initials = (a?: string | null, b?: string | null) =>
  `${a?.[0] ?? ""}${b?.[0] ?? ""}`.toUpperCase() || "?";

const formatRelative = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days <= 0) return "Hoy";
  if (days === 1) return "Ayer";
  if (days < 7) return `Hace ${days}d`;
  if (days < 30) return `Hace ${Math.floor(days / 7)}sem`;
  return `Hace ${Math.floor(days / 30)}m`;
};

interface Props {
  onPick: (partner: RecentPartner) => void;
}

/**
 * Carrusel horizontal estilo Uber Eats con los últimos partners del usuario.
 * Tap → invitar de nuevo con un click.
 */
export const RecentPartnersStrip = ({ onPick }: Props) => {
  const { rows, loading } = useRecentPartners(8);

  if (loading) {
    return (
      <div className="flex gap-3 overflow-x-auto pb-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex w-[58px] shrink-0 flex-col items-center gap-1.5">
            <Skeleton className="h-11 w-11 rounded-full" />
            <Skeleton className="h-2.5 w-10" />
          </div>
        ))}
      </div>
    );
  }

  if (rows.length === 0) return null;

  return (
    <div className="relative">
      <div className="flex gap-2.5 overflow-x-auto overflow-y-hidden py-1.5 scrollbar-none">
          {rows.map((p) => (
            <button
              key={p.user_id}
              type="button"
              onClick={() => onPick(p)}
              className="flex w-[58px] shrink-0 flex-col items-center gap-1 text-center transition-smooth active:scale-95"
            >
              <Avatar className="h-11 w-11 ring-1 ring-primary/30 ring-offset-2 ring-offset-background">
                <AvatarImage src={p.avatar_url ?? undefined} />
                <AvatarFallback className="text-xs">
                  {initials(p.first_name, p.last_name)}
                </AvatarFallback>
              </Avatar>
              <span className="line-clamp-1 w-full text-[11px] font-medium leading-tight">
                {p.first_name}
              </span>
              <span className="text-[9px] leading-none text-muted-foreground">
                {formatRelative(p.last_played_at)}
              </span>
            </button>
          ))}
      </div>
      {/* fade hint */}
      <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background to-transparent" />
    </div>
  );
};
