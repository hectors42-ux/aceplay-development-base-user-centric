import { useQuery } from "@tanstack/react-query";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import { useActiveSport } from "@/components/providers/SportProvider";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

// Mi historia EN ESTE CLUB (Tanda 3, SOLO LECTURA): evolución del NIVEL 0–7
// (rating_to_nivel, NUNCA el Glicko crudo) + stats agregadas. Por club + deporte.
interface Point { at: string; nivel: number }
interface Stats { partidos_jugados: number; partidos_ganados: number; win_rate: number; torneos: number; escalerillas: number; podios: number }

const Stat = ({ value, label, accent }: { value: string | number; label: string; accent?: boolean }) => (
  <div className="rounded-2xl border border-border bg-card p-3 text-center">
    <p className={accent ? "font-display text-2xl font-black text-skill" : "font-display text-2xl font-black text-foreground"}>{value}</p>
    <p className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
  </div>
);

export function ClubHistory({ clubId }: { clubId: string }) {
  const { user } = useAuth();
  const { sport } = useActiveSport();
  const dbSport = sport === "padel" ? "padel" : "tennis";

  const { data, isLoading } = useQuery({
    queryKey: ["club-history", clubId, dbSport, user?.id],
    enabled: !!clubId && !!user,
    queryFn: async () => {
      const [hist, st] = await Promise.all([
        supabase.rpc("club_level_history", { _club_id: clubId, _sport: dbSport }),
        supabase.rpc("club_player_stats", { _club_id: clubId, _sport: dbSport }),
      ]);
      return {
        points: ((hist.data as Point[] | null) ?? []).map((p, idx) => ({ idx, nivel: Number(p.nivel), at: p.at })),
        stats: ((st.data as Stats[] | null) ?? [])[0] ?? null,
      };
    },
  });

  if (isLoading) return <Skeleton className="h-48 w-full rounded-2xl" />;

  const points = data?.points ?? [];
  const stats = data?.stats;
  const hasPlayed = (stats?.partidos_jugados ?? 0) > 0 || points.length > 0;
  if (!hasPlayed) {
    return (
      <p className="rounded-2xl border border-dashed border-border bg-card/50 p-6 text-center text-sm text-muted-foreground">
        Aún no tienes partidos con historial en este club.
      </p>
    );
  }

  // Tendencia entre el primer y último punto del nivel.
  const trend = points.length >= 2 ? points[points.length - 1].nivel - points[0].nivel : 0;
  const TrendIcon = trend > 0.05 ? TrendingUp : trend < -0.05 ? TrendingDown : Minus;
  const trendLabel = trend > 0.05 ? "subiendo" : trend < -0.05 ? "bajando" : "estable";

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Mi historia · evolución de Nivel
        </p>
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-skill">
          <TrendIcon className="h-3.5 w-3.5" /> {trendLabel}
        </span>
      </div>

      {points.length >= 1 && (
        <div className="h-[180px] w-full rounded-2xl border border-border bg-card p-3">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 10, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" opacity={0.4} />
              <XAxis dataKey="idx" tick={false} axisLine={false} tickLine={false} />
              <YAxis
                domain={[0, 7]} ticks={[0, 1, 2, 3, 4, 5, 6, 7]}
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false} tickLine={false} width={28}
              />
              <Tooltip
                contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--background))" }}
                formatter={(value: number) => [Number(value).toFixed(2), "Nivel"]}
                labelFormatter={(_, p) => { const d = p?.[0]?.payload?.at; return d ? format(new Date(d), "d MMM", { locale: es }) : ""; }}
              />
              <Line type="monotone" dataKey="nivel" stroke="hsl(var(--skill))" strokeWidth={2.5}
                dot={{ r: 3, fill: "hsl(var(--skill))" }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-3 gap-2">
          <Stat value={stats.partidos_jugados} label="Jugados" />
          <Stat value={stats.partidos_ganados} label="Ganados" />
          <Stat value={`${stats.win_rate}%`} label="Win rate" accent />
          <Stat value={stats.torneos} label="Torneos" />
          <Stat value={stats.escalerillas} label="Escalerillas" />
          <Stat value={stats.podios} label="Podios" />
        </div>
      )}
    </section>
  );
}
