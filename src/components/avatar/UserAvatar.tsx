import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { RallyAvatar } from "@/components/avatar/RallyAvatar";
import { cn } from "@/lib/utils";

const initialsOf = (name?: string | null) =>
  (name ?? "").split(" ").map((n) => n[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "?";

export interface UserAvatarData {
  kind?: string | null;
  look?: string | null;
  url?: string | null;
  name?: string | null;
}

/**
 * Renderiza el avatar correcto: foto (kind='photo' + url) o la mascota Rally
 * (kind='rally', con su look). Tamaño por className (h-/w-). Es el único punto
 * que decide foto vs Rally, para mantener estable el resto de la app.
 */
export const UserAvatar = ({ kind, look, url, name, className }: UserAvatarData & { className?: string }) => {
  if (kind === "photo" && url) {
    return (
      <Avatar className={className}>
        <AvatarImage src={url} alt={name ?? ""} />
        <AvatarFallback className="bg-gradient-clay text-[11px] font-semibold text-primary-foreground">
          {initialsOf(name)}
        </AvatarFallback>
      </Avatar>
    );
  }
  return (
    <span className={cn("inline-flex shrink-0 overflow-hidden rounded-full bg-muted", className)}>
      <RallyAvatar look={look ?? "classic"} />
    </span>
  );
};

export default UserAvatar;
