import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { Dialog, DialogPortal, DialogOverlay } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string | null;
  name: string;
  initials: string;
}

/**
 * Visor de avatar a tamaño grande sin pérdida de calidad.
 * - Solo muestra el círculo con la imagen (sin tarjeta blanca ni nombre).
 * - Para imágenes remotas (DiceBear, etc.) intenta solicitar 512px.
 */
export const AvatarViewer = ({ open, onOpenChange, url, name, initials }: Props) => {
  const hiResUrl = url
    ? url.includes("api.dicebear.com")
      ? url.replace(/size=\d+/, "size=512")
      : url
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-[50%] top-[50%] z-50 w-[85vw] max-w-[360px] translate-x-[-50%] translate-y-[-50%]",
            "duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "focus:outline-none",
          )}
        >
          <div className="relative aspect-square w-full overflow-hidden rounded-full border-4 border-background bg-background shadow-elevated ring-2 ring-primary/30">
            {hiResUrl ? (
              <img
                src={hiResUrl}
                alt={name}
                className="h-full w-full rounded-full object-cover"
                loading="eager"
              />
            ) : (
              <Avatar className="h-full w-full">
                <AvatarFallback className="text-5xl font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
            )}
          </div>
          <DialogPrimitive.Close
            className="absolute right-2 top-2 rounded-full bg-background/90 p-1.5 text-foreground shadow-elevated ring-1 ring-border transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
};
