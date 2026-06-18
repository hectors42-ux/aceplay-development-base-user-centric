import { BookOpen } from "lucide-react";
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

const GLOSSARY: Array<{ section: string; items: Array<{ term: string; desc: string }> }> = [
  {
    section: "Resumen",
    items: [
      { term: "Salud del club", desc: "Índice 0–100 que combina ocupación, mora, actividad de socios y desafíos. ≥75 saludable, 50–74 atención, <50 crítico." },
      { term: "Ocupación", desc: "% de slots reservados sobre la capacidad disponible en el período. Δpp compara con el período anterior." },
      { term: "Ingresos clases", desc: "Suma de pagos confirmados de clases con coach (CLP) en el período." },
      { term: "Mora", desc: "Cantidad de socios con cuotas pendientes a la fecha." },
      { term: "Socios activos 30d", desc: "Socios con al menos una reserva, clase o partido en los últimos 30 días." },
      { term: "Inactivos 30d", desc: "Socios sin actividad registrada en los últimos 30 días." },
      { term: "Torneos / Desafíos activos", desc: "Torneos en curso y desafíos de Pirámide aún no resueltos." },
      { term: "Partidos 7d", desc: "Partidos jugados (torneos + ladder) en los últimos 7 días." },
    ],
  },
  {
    section: "Operación",
    items: [
      { term: "Mapa de calor día × hora", desc: "Intensidad de color según reservas confirmadas. Zonas oscuras = saturación, claras = horarios valle con potencial." },
    ],
  },
  {
    section: "Finanzas",
    items: [
      { term: "Ingresos por línea", desc: "Clases activas hoy. Cuotas / reservas / torneos se activan al integrar Webpay (S3)." },
      { term: "Mora 30 / 60 / 90+", desc: "Socios morosos segmentados por antigüedad de la deuda en días." },
    ],
  },
  {
    section: "Socios",
    items: [
      { term: "Categorías A / B / C", desc: "Distribución por rating: A (avanzado), B (intermedio), C (iniciación)." },
      { term: "Sin rating", desc: "Socios que aún no completan el onboarding deportivo." },
      { term: "Socios estrella", desc: "Top por número de reservas en el período." },
      { term: "Socios en riesgo", desc: "Sin actividad ≥ 60 días — candidatos a campaña de retención." },
      { term: "Funnel de desafíos", desc: "Enviados → Aceptados → Jugados. Mide la salud competitiva del club." },
    ],
  },
  {
    section: "Coaches",
    items: [
      { term: "Clases", desc: "Clases dictadas por el coach en el período." },
      { term: "Ingresos / Ticket prom.", desc: "Total CLP generado y promedio por clase." },
      { term: "Canceladas", desc: "Clases canceladas dentro del período (señal de calidad / cumplimiento)." },
    ],
  },
  {
    section: "Comunidad",
    items: [
      { term: "Tiempo aceptación / a jugar", desc: "Horas promedio entre desafío → aceptación, y aceptación → partido jugado." },
      { term: "Top progreso / caída", desc: "Mayores subidas y bajadas de rating en el período." },
      { term: "Pirámides activas", desc: "Ladders ordenadas por partidos jugados." },
    ],
  },
  {
    section: "Alertas",
    items: [
      { term: "Críticas", desc: "Requieren acción inmediata: mora alta, canchas saturadas, torneos atrasados." },
      { term: "Oportunidades", desc: "Mejoras posibles: horarios valle, socios para reactivar, coaches con cupo." },
      { term: "Automatizaciones", desc: "Acciones recurrentes (próximamente): campañas, recordatorios, reportes." },
    ],
  },
];

interface AnalyticsGlossaryDialogProps {
  triggerClassName?: string;
  variant?: "icon" | "text";
}

export function AnalyticsGlossaryDialog({ triggerClassName, variant = "icon" }: AnalyticsGlossaryDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {variant === "icon" ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className={triggerClassName ?? "h-8 gap-1.5 px-2 text-xs"}
            aria-label="Glosario de indicadores"
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Glosario</span>
          </Button>
        ) : (
          <Button type="button" variant="outline" size="sm" className={triggerClassName}>
            <BookOpen className="mr-2 h-4 w-4" />
            ¿Qué significa cada indicador?
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-hidden p-0">
        <DialogHeader className="border-b border-border/60 px-5 py-4">
          <DialogTitle className="font-display text-lg">Manual de la analítica</DialogTitle>
          <DialogDescription className="text-xs">
            Qué mide y cómo interpretar cada indicador del centro de inteligencia del club.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[65vh]">
          <div className="space-y-5 px-5 py-4">
            {GLOSSARY.map((g) => (
              <section key={g.section} className="space-y-2">
                <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-primary">
                  {g.section}
                </h3>
                <ul className="space-y-2">
                  {g.items.map((it) => (
                    <li key={it.term} className="rounded-lg bg-muted/40 p-3">
                      <p className="text-sm font-semibold text-foreground">{it.term}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{it.desc}</p>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
