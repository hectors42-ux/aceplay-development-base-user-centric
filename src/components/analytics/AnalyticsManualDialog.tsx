import { BookOpen, BarChart3 } from "lucide-react";
import { Link } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

const SECTIONS: Array<{ title: string; desc: string }> = [
  {
    title: "Resumen",
    desc: "Health score, ocupación, socios activos 30d, ingresos por clases y top coaches del período.",
  },
  {
    title: "Operación",
    desc: "Mapa de calor día × hora para detectar canchas saturadas y horarios valle.",
  },
  {
    title: "Finanzas",
    desc: "Ingresos por clases y mora segmentada (30 / 60 / 90+ días).",
  },
  {
    title: "Coaches",
    desc: "Ranking por clases dictadas, ingresos y ticket promedio.",
  },
  {
    title: "Socios",
    desc: "Distribución por categoría (A/B/C), socios estrella, embudo de desafíos y socios en riesgo.",
  },
  {
    title: "Comunidad",
    desc: "Ladders activas, tiempo medio de aceptación y mayores subidas/caídas de rating.",
  },
  {
    title: "Alertas",
    desc: "Avisos críticos (mora, saturación, torneos atrasados) y oportunidades de mejora.",
  },
  {
    title: "Directorio",
    desc: "Resumen ejecutivo mensual (acceso restringido a super admin).",
  },
];

export function AnalyticsManualDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 text-sm font-medium text-foreground shadow-card transition-smooth hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            Manual de la analítica
          </span>
          <span className="text-[11px] text-muted-foreground">8 vistas</span>
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-md overflow-hidden p-0">
        <DialogHeader className="border-b border-border/60 px-5 py-4">
          <DialogTitle className="font-display text-lg">Manual de la analítica</DialogTitle>
          <DialogDescription className="text-xs">
            Centro de control con 8 vistas que cruzan reservas, clases, ladder, torneos, pagos y telemetría
            para entender la salud real del club en tiempo real.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[55vh]">
          <ul className="space-y-2 px-5 py-4">
            {SECTIONS.map((s) => (
              <li key={s.title} className="rounded-xl bg-muted/40 p-3">
                <p className="font-display text-sm font-semibold text-foreground">{s.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{s.desc}</p>
              </li>
            ))}
          </ul>
          <p className="mx-5 mb-4 rounded-lg bg-primary/5 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
            Filtros por rango de fechas y disciplina. Datos en vivo: cada vista refresca con la actividad real del club.
          </p>
        </ScrollArea>
        <div className="border-t border-border/60 px-5 py-3">
          <Button asChild className="w-full">
            <Link to="/admin/analytics">
              <BarChart3 className="mr-2 h-4 w-4" />
              Abrir analítica del club
            </Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
