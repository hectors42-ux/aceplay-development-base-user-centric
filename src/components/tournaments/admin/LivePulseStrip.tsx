import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface MatchLite {
  id: string;
  status: string;
  scheduled_at: string | null;
  tournament_category_id: string;
}

interface Props {
  tournamentId: string;
}

export function LivePulseStrip({ tournamentId }: Props) {
  const [live, setLive] = useState<MatchLite[]>([]);
  const [upcoming, setUpcoming] = useState<MatchLite[]>([]);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const { data } = await supabase
        .from("tournament_matches")
        .select("id,status,scheduled_at,tournament_category_id")
        .eq("tournament_id", tournamentId);
      if (cancel) return;
      const rows = (data ?? []) as MatchLite[];
      const liveRows = rows.filter((m) => m.status === "en_curso");
      const upcomingRows = rows
        .filter(
          (m) =>
            m.status === "pendiente" &&
            m.scheduled_at &&
            new Date(m.scheduled_at).getTime() > Date.now(),
        )
        .sort((a, b) => (a.scheduled_at! < b.scheduled_at! ? -1 : 1))
        .slice(0, 3);
      setLive(liveRows);
      setUpcoming(upcomingRows);
    })();
    return () => {
      cancel = true;
    };
  }, [tournamentId]);

  if (live.length > 0) {
    return (
      <div>
        <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.32em] text-muted-foreground">
          Pulso en vivo
        </p>
        <div className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto pb-1">
          {live.map((m) => (
            <Link
              key={m.id}
              to={`/admin/torneos/${tournamentId}/cat/${m.tournament_category_id}`}
              className="snap-start"
            >
              <div className="flex w-60 flex-none flex-col gap-2 rounded-2xl bg-gradient-to-br from-[hsl(var(--ink))] to-[hsl(var(--primary-deep))] p-3 text-white shadow-xl">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/80 opacity-75" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
                    </span>
                    Live
                  </span>
                  <span className="text-[10px] opacity-70">En curso</span>
                </div>
                <p className="text-xs text-white/80">Toca para ver detalle</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  if (upcoming.length === 0) return null;

  return (
    <div>
      <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.32em] text-muted-foreground">
        Próximos partidos
      </p>
      <div className="space-y-2">
        {upcoming.map((m) => (
          <Link
            key={m.id}
            to={`/admin/torneos/${tournamentId}/cat/${m.tournament_category_id}`}
            className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 transition-colors hover:bg-muted/40"
          >
            <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="flex-1 text-xs">
              {m.scheduled_at &&
                new Date(m.scheduled_at).toLocaleString("es-CL", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}