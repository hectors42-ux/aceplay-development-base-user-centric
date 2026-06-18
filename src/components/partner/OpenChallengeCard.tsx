import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";
import type { OpenPost } from "@/hooks/useMatchOpenPosts";
import { cn } from "@/lib/utils";

const initials = (a?: string | null, b?: string | null) =>
  `${a?.[0] ?? ""}${b?.[0] ?? ""}`.toUpperCase() || "?";

const formatSlot = (iso: string) =>
  new Date(iso).toLocaleString("es-CL", {
    weekday: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

interface Props {
  post: OpenPost;
  overlapCount: number;
  isOwn: boolean;
  onInvite: () => void;
  onCancel?: () => void;
}

export const OpenChallengeCard = ({ post, overlapCount, isOwn, onInvite, onCancel }: Props) => {
  return (
    <div
      className={cn(
        "rounded-2xl border p-4 shadow-card transition-smooth",
        isOwn
          ? "border-primary/40 bg-primary/5"
          : "border-border bg-card hover:border-primary/30",
      )}
    >
      <div className="flex items-start gap-3">
        <Avatar className="h-9 w-9">
          <AvatarImage src={post.author?.avatar_url ?? undefined} />
          <AvatarFallback className="text-[11px]">{initials(post.author?.first_name, post.author?.last_name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium">
              {isOwn ? "Tu reto abierto" : `${post.author?.first_name ?? ""} ${post.author?.last_name ?? ""}`}
            </p>
            {isOwn && (
              <Badge variant="outline" className="h-4 rounded-md border-primary/40 px-1.5 text-[9px] font-semibold text-primary">
                Activo
              </Badge>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground">
            Formato: {post.format === "1set" ? "1 set" : post.format === "best_of_3" ? "Mejor de 3" : "Mejor de 5"}
          </p>
        </div>
        {!isOwn && overlapCount > 0 && (
          <Badge className="h-4 rounded-md bg-success/15 px-1.5 text-[9px] font-semibold text-success hover:bg-success/15">
            {overlapCount} en común
          </Badge>
        )}
      </div>

      {post.note && <p className="mt-2 text-xs italic text-muted-foreground">"{post.note}"</p>}

      {Array.isArray(post.available_slots) && post.available_slots.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {post.available_slots.slice(0, 6).map((s, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-[10px]"
            >
              <Clock className="h-2.5 w-2.5" />
              {formatSlot(s.starts_at)}
            </span>
          ))}
        </div>
      )}

      {isOwn ? (
        <Button variant="ghost" size="sm" className="mt-3 w-full text-xs" onClick={onCancel}>
          Cancelar reto
        </Button>
      ) : (
        <Button variant="clay" size="sm" className="mt-3 w-full" onClick={onInvite}>
          Invitar a uno de estos horarios
        </Button>
      )}
    </div>
  );
};
