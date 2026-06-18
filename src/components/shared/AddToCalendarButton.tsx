import { CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadIcs } from "@/lib/ics";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface AddToCalendarButtonProps {
  title: string;
  description?: string;
  location?: string;
  startsAt: string | Date;
  endsAt: string | Date;
  filename?: string;
  size?: "sm" | "default";
  variant?: "outline" | "ghost" | "clay" | "default";
  className?: string;
  label?: string;
  /** IANA timezone. Default: America/Santiago */
  timezone?: string;
  /** Recordatorios en minutos antes del inicio. Default: [60, 15]. Vacío = ninguno. */
  reminderMinutes?: number[];
}

export const AddToCalendarButton = ({
  title,
  description,
  location,
  startsAt,
  endsAt,
  filename,
  size = "sm",
  variant = "outline",
  className,
  label = "Agregar a mi calendario",
  timezone = "America/Santiago",
  reminderMinutes = [60, 15],
}: AddToCalendarButtonProps) => {
  const handleClick = () => {
    try {
      downloadIcs(
        { title, description, location, startsAt, endsAt, timezone, reminderMinutes },
        filename ?? `${title.replace(/\s+/g, "-").toLowerCase()}.ics`,
      );
      toast({
        title: "Evento descargado",
        description: "Abre el archivo .ics para añadirlo a tu calendario.",
      });
    } catch (err) {
      console.error("[ics] download failed", err);
      toast({
        title: "No se pudo generar el evento",
        variant: "destructive",
      });
    }
  };

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={handleClick}
      className={cn("gap-1.5", className)}
    >
      <CalendarPlus className="h-3.5 w-3.5" />
      {label}
    </Button>
  );
};
