import { Crown, Swords, X } from "lucide-react";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { PlayerProfileCard } from "@/components/profile/PlayerProfileCard";
import { cn } from "@/lib/utils";
import type { PositionRow, ProfileLite } from "@/hooks/useLadderData";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  position: PositionRow | null;
  profile: ProfileLite | null;
  isMe: boolean;
  reachable: boolean;
  onChallenge: () => void;
}

export const PlayerDetailDrawer = ({
  open,
  onOpenChange,
  position,
  profile,
  isMe,
  reachable,
  onChallenge,
}: Props) => {
  if (!position) return null;
  const name = profile ? `${profile.first_name} ${profile.last_name}` : "Jugador";

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <div className="mx-auto w-full max-w-md">
          <DrawerHeader className="text-left">
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl font-display text-sm font-bold",
                  position.position === 1
                    ? "bg-gradient-clay text-primary-foreground shadow-clay"
                    : "bg-muted text-foreground",
                )}
              >
                {position.position === 1 ? <Crown className="h-5 w-5" /> : `#${position.position}`}
              </div>
              <div className="min-w-0 flex-1">
                <DrawerTitle className="truncate font-display text-base">{name}</DrawerTitle>
                <DrawerDescription className="text-xs">
                  Pirámide · Posición #{position.position}
                  {isMe && " · Tú"}
                  {position.status !== "activo" && ` · ${position.status}`}
                </DrawerDescription>
              </div>
              <DrawerClose asChild>
                <button
                  type="button"
                  aria-label="Cerrar"
                  className="rounded-full border border-border bg-card p-1.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </DrawerClose>
            </div>
          </DrawerHeader>

          <div className="max-h-[65vh] overflow-y-auto px-4 pb-2">
            <PlayerProfileCard userId={position.user_id} mode="public" />
          </div>

          <DrawerFooter>
            {!isMe && reachable ? (
              <Button
                variant="clay"
                onClick={() => {
                  onOpenChange(false);
                  onChallenge();
                }}
              >
                <Swords className="h-4 w-4" /> Desafiar
              </Button>
            ) : !isMe ? (
              <p className="text-center text-xs text-muted-foreground">
                Fuera de tu rango de desafío.
              </p>
            ) : null}
            <DrawerClose asChild>
              <Button variant="ghost">Cerrar</Button>
            </DrawerClose>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
