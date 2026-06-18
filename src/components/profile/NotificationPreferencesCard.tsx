import { Bell } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useUserPushPreferences } from "@/hooks/useUserPushPreferences";
import type { PushCategory } from "@/lib/push-templates";

const ROWS: { key: PushCategory; label: string; hint: string }[] = [
  { key: "juego", label: "Juego", hint: "Sorteos, resultados, rivales, rondas. Esencial." },
  { key: "marketing", label: "Marketing", hint: "Trial, ofertas y novedades del club." },
  { key: "sistema", label: "Sistema", hint: "Asignaciones, cambios admin, recordatorios." },
];

export function NotificationPreferencesCard() {
  const { prefs, update, loading } = useUserPushPreferences();

  return (
    <section className="space-y-2 px-5">
      <h2 className="flex items-center gap-2 font-display text-base font-semibold">
        <Bell className="h-4 w-4" /> Notificaciones
      </h2>
      <div className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-card">
        {ROWS.map((row) => (
          <div key={row.key} className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{row.label}</p>
              <p className="text-xs text-muted-foreground">{row.hint}</p>
            </div>
            <Switch
              checked={prefs[row.key]}
              disabled={loading}
              onCheckedChange={(v) => update({ [row.key]: v } as Partial<typeof prefs>)}
              aria-label={`Notificaciones de ${row.label}`}
            />
          </div>
        ))}
      </div>
    </section>
  );
}