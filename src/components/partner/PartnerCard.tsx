import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FitRing } from "./FitRing";
import type { PartnerSuggestion } from "@/hooks/usePartnerSuggestions";

const initials = (a?: string | null, b?: string | null) =>
  `${a?.[0] ?? ""}${b?.[0] ?? ""}`.toUpperCase() || "?";

interface Props {
  partner: PartnerSuggestion;
  onSkip: () => void;
  onInvite: () => void;
}

export const PartnerCard = ({ partner, onSkip, onInvite }: Props) => {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
      <div className="flex items-center gap-3">
        <Avatar className="h-9 w-9">
          <AvatarImage src={partner.avatar_url ?? undefined} />
          <AvatarFallback className="text-[11px]">{initials(partner.first_name, partner.last_name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            {partner.first_name} {partner.last_name}
          </p>
          <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span>Nivel {partner.level?.toFixed(2) ?? "—"}</span>
            {partner.level_diff != null && (
              <span>· Δ {partner.level_diff.toFixed(2)}</span>
            )}
          </div>
        </div>
        <FitRing score={partner.compat_score} />
      </div>

      {partner.reasons && partner.reasons.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {partner.reasons.slice(0, 3).map((r) => (
            <Badge key={r} variant="outline" className="h-4 rounded-md px-1.5 text-[9px] font-semibold">
              {r}
            </Badge>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onSkip} className="h-8 text-xs">
          Saltar
        </Button>
        <Button variant="clay" size="sm" onClick={onInvite} className="h-8 text-xs">
          Invitar
        </Button>
      </div>
    </div>
  );
};
