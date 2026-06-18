import { TrendingUp, Swords, Clock } from "lucide-react";
import { useHomeStats } from "@/hooks/useHomeStats";

const formatLevel = (lvl: number | null) => (lvl == null ? "—" : lvl.toFixed(2));
const formatPosition = (p: number | null) => (p == null ? "—" : `#${p}`);

export const StatsRow = () => {
  const { loading, level, matchesPlayed, ladderPosition, hoursThisMonth } = useHomeStats();

  const stats = [
    {
      label: "Tu nivel",
      value: loading ? "…" : formatLevel(level),
      icon: TrendingUp,
      hint: matchesPlayed > 0 ? `${matchesPlayed} match${matchesPlayed === 1 ? "" : "es"} jugados` : "Sin matches aún",
    },
    {
      label: "Horas este mes",
      value: loading ? "…" : `${hoursThisMonth}`,
      icon: Clock,
      hint: hoursThisMonth > 0 ? "Reservas confirmadas" : "Sin reservas",
    },
    {
      label: "Posición ladder",
      value: loading ? "…" : formatPosition(ladderPosition),
      icon: Swords,
      hint: ladderPosition ? "Pirámide activa" : "No estás en Pirámide",
    },
  ];

  return (
    <section aria-label="Tus estadísticas" className="px-5">
      <div className="grid grid-cols-3 gap-2.5">
        {stats.map((s, i) => {
          const Icon = s.icon;
          return (
            <div
              key={s.label}
              style={{ animationDelay: `${i * 50}ms` }}
              className="animate-scale-in rounded-2xl border border-border bg-card p-3 shadow-card"
            >
              <Icon className="mb-2 h-4 w-4 text-primary" strokeWidth={2.4} />
              <p className="font-display text-xl font-semibold leading-none text-foreground">
                {s.value}
              </p>
              <p className="mt-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {s.label}
              </p>
              <p className="mt-1 line-clamp-1 text-[10px] text-muted-foreground">{s.hint}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
};
