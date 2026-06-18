import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Plus, X, Check, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OpenPost, OpenSlotRow } from "@/hooks/useMatchOpenPosts";

const initials = (a?: string | null, b?: string | null) =>
  `${a?.[0] ?? ""}${b?.[0] ?? ""}`.toUpperCase() || "?";

const formatSlot = (iso: string) =>
  new Date(iso).toLocaleString("es-CL", {
    weekday: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const FORMAT_LABEL: Record<string, string> = {
  "1set": "1 set",
  best_of_3: "Mejor de 3",
  best_of_5: "Mejor de 5",
};

interface Props {
  post: OpenPost;
  overlapCount: number;
  isOwn: boolean;
  currentUserId: string | null | undefined;
  onJoin: () => void;
  onLeave: () => void;
  onCancel: () => void;
  loading?: boolean;
}

const SlotChip = ({ slot }: { slot: OpenSlotRow }) => {
  if (!slot.user_id) {
    return (
      <div className="flex flex-col items-center gap-1">
        <div className="h-10 w-10 rounded-full border-2 border-dashed border-primary/40 bg-primary/5 flex items-center justify-center">
          <Plus className="h-4 w-4 text-primary/70" />
        </div>
        <span className="text-[9px] uppercase tracking-wider text-primary/80">Libre</span>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-1">
      <Avatar className="h-10 w-10 ring-2 ring-primary/30">
        <AvatarImage src={slot.profile?.avatar_url ?? undefined} />
        <AvatarFallback className="text-[10px]">
          {initials(slot.profile?.first_name, slot.profile?.last_name)}
        </AvatarFallback>
      </Avatar>
      <span className="max-w-[60px] truncate text-[9px] text-muted-foreground">
        {slot.profile?.first_name ?? ""}
      </span>
    </div>
  );
};

export const OpenMatchCard = ({
  post,
  overlapCount,
  isOwn,
  currentUserId,
  onJoin,
  onLeave,
  onCancel,
  loading,
}: Props) => {
  const team1 = post.slots.filter((s) => s.team === 1).sort((a, b) => a.slot_index - b.slot_index);
  const team2 = post.slots.filter((s) => s.team === 2).sort((a, b) => a.slot_index - b.slot_index);
  const userInSlot = post.slots.find((s) => s.user_id === currentUserId);
  const isMember = !!userInSlot;
  const filled = post.slots.filter((s) => s.user_id).length;
  const isFull = filled === post.slots.length;

  return (
    <div
      className={cn(
        "rounded-2xl border p-4 shadow-card transition-smooth",
        isOwn
          ? "border-primary/40 bg-primary/5"
          : "border-border bg-card hover:border-primary/30",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className="h-5 rounded-md border-primary/30 px-1.5 text-[9px] font-semibold uppercase text-primary">
            {post.match_type === "singles" ? "Singles" : "Dobles"} · {post.sport === "padel" ? "Pádel" : "Tenis"}
          </Badge>
          <Badge variant="outline" className="h-5 rounded-md px-1.5 text-[9px] font-medium">
            {FORMAT_LABEL[post.format] ?? post.format}
          </Badge>
          {isOwn && (
            <Badge className="h-5 rounded-md bg-primary px-1.5 text-[9px] font-semibold text-primary-foreground">
              Tu reto
            </Badge>
          )}
          {!isOwn && overlapCount > 0 && (
            <Badge className="h-5 rounded-md bg-success/15 px-1.5 text-[9px] font-semibold text-success hover:bg-success/15">
              {overlapCount} ✓ tu agenda
            </Badge>
          )}
        </div>
      </div>

      {/* Equipos */}
      <div className="mt-3 flex items-center justify-center gap-3">
        <div className="flex gap-2">{team1.map((s) => <SlotChip key={s.id} slot={s} />)}</div>
        <span className="font-display text-sm font-semibold text-muted-foreground">vs</span>
        <div className="flex gap-2">{team2.map((s) => <SlotChip key={s.id} slot={s} />)}</div>
      </div>

      {/* Filtros nivel/género */}
      {(post.level_min != null || post.level_max != null || post.gender_filter !== "any") && (
        <div className="mt-2 flex flex-wrap justify-center gap-1.5 text-[10px] text-muted-foreground">
          {(post.level_min != null || post.level_max != null) && (
            <span>
              Nivel {post.level_min?.toFixed(1) ?? "0.0"}–{post.level_max?.toFixed(1) ?? "7.0"}
            </span>
          )}
          {post.gender_filter !== "any" && (
            <span>· {post.gender_filter === "female" ? "Mujeres" : post.gender_filter === "male" ? "Hombres" : "Mixto"}</span>
          )}
        </div>
      )}

      {post.note && <p className="mt-2 text-center text-xs italic text-muted-foreground">"{post.note}"</p>}

      {/* Horarios */}
      {Array.isArray(post.available_slots) && post.available_slots.length > 0 && (
        <div className="mt-3 flex flex-wrap justify-center gap-1.5">
          {post.available_slots.slice(0, 4).map((s, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-[10px]"
            >
              <Clock className="h-2.5 w-2.5" />
              {formatSlot(s.starts_at)}
            </span>
          ))}
          {post.available_slots.length > 4 && (
            <span className="text-[10px] text-muted-foreground">+{post.available_slots.length - 4}</span>
          )}
        </div>
      )}

      {/* Acción */}
      <div className="mt-3">
        {isOwn ? (
          <Button variant="ghost" size="sm" className="w-full text-xs" onClick={onCancel} disabled={loading}>
            <X className="mr-1 h-3.5 w-3.5" /> Cancelar reto
          </Button>
        ) : isMember ? (
          <Button variant="ghost" size="sm" className="w-full text-xs" onClick={onLeave} disabled={loading}>
            Salirme del partido
          </Button>
        ) : isFull ? (
          <Button variant="outline" size="sm" className="w-full text-xs" disabled>
            Sin cupos
          </Button>
        ) : (
          <Button variant="clay" size="sm" className="w-full" onClick={onJoin} disabled={loading}>
            <UserPlus className="mr-1 h-4 w-4" />
            {post.mode === "pair_vs_pair" ? "Unirme con mi pareja" : "Unirme"}
          </Button>
        )}
        {isOwn && isFull && (
          <div className="mt-1.5 text-center text-[10px] text-success">
            <Check className="mr-1 inline h-3 w-3" />
            Cupos completos
          </div>
        )}
      </div>
    </div>
  );
};
