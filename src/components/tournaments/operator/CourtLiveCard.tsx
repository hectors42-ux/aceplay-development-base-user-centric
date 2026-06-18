import { useEffect, useState } from "react";
import { Loader2, Radio } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { CourtMatchView } from "@/hooks/useOperatorBoard";

interface Props {
  view: CourtMatchView;
  isMyMatch: boolean;
  onStart: () => void;
  onLoadResult: () => void;
  pending: boolean;
  streamEnabled?: boolean;
  tournamentId?: string | null;
}

const STATUS_META: Record<
  CourtMatchView["liveStatus"],
  { label: string; border: string; badge: string }
> = {
  calentando: {
    label: "Calentando",
    border: "border-amber-500/60",
    badge: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  },
  en_juego: {
    label: "En juego",
    border: "border-primary motion-safe:shadow-[0_0_24px_hsl(var(--primary)/0.25)]",
    badge: "bg-primary/15 text-primary",
  },
  cerrado: {
    label: "Cerrado",
    border: "border-success/40 opacity-65",
    badge: "bg-success/15 text-success",
  },
};

function pairLine(side: { display_name: string }[]) {
  if (side.length === 0) return "—";
  return side.map((p) => p.display_name).join(" · ");
}

function scoreLabel(score: unknown): string | null {
  if (!score || typeof score !== "object") return null;
  const sets = score as Array<{ a?: number; b?: number }>;
  if (!Array.isArray(sets) || sets.length === 0) return null;
  return sets.map((s) => `${s.a ?? 0}-${s.b ?? 0}`).join(" / ");
}

export function CourtLiveCard({ view, isMyMatch, onStart, onLoadResult, pending, streamEnabled, tournamentId }: Props) {
  const meta = STATUS_META[view.liveStatus];
  const score = scoreLabel(view.match.score);
  const [featuredMatchId, setFeaturedMatchId] = useState<string | null>(null);
  const [featuring, setFeaturing] = useState(false);

  useEffect(() => {
    if (!streamEnabled || !tournamentId) return;
    let cancelled = false;
    const load = () => {
      supabase
        .from("tournament_stream_featured")
        .select("match_id")
        .eq("tournament_id", tournamentId)
        .maybeSingle()
        .then(({ data }) => {
          if (!cancelled) setFeaturedMatchId((data as { match_id: string | null } | null)?.match_id ?? null);
        });
    };
    load();
    const ch = supabase
      .channel(`featured-${tournamentId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tournament_stream_featured", filter: `tournament_id=eq.${tournamentId}` }, load)
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [streamEnabled, tournamentId]);

  const handleFeature = async () => {
    if (!tournamentId) return;
    setFeaturing(true);
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user.id;
    const { error } = await supabase
      .from("tournament_stream_featured")
      .upsert(
        { tournament_id: tournamentId, match_id: view.match.id, set_by: uid ?? null, set_at: new Date().toISOString() },
        { onConflict: "tournament_id" },
      );
    setFeaturing(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Destacado en stream", description: "El overlay público se actualizó." });
  };

  const isFeatured = featuredMatchId === view.match.id;

  return (
    <article
      className={cn(
        "rounded-2xl border-2 bg-card p-3 transition-smooth",
        meta.border,
        isMyMatch && "ring-2 ring-primary ring-offset-2 ring-offset-background",
      )}
    >
      <header className="flex items-center justify-between gap-2">
        <h3 className="font-display text-sm font-semibold">
          {view.courtLabel}
          {isMyMatch && (
            <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.32em] text-primary">
              [Tú]
            </span>
          )}
        </h3>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em]",
            meta.badge,
          )}
        >
          {meta.label}
        </span>
      </header>

      <div className="mt-2 space-y-1 text-sm">
        <p className={cn("truncate", view.match.winner_side === "a" && "font-semibold")}>
          {pairLine(view.sideA)}
        </p>
        {score ? (
          <p className="font-mono text-xs text-muted-foreground">{score}</p>
        ) : (
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">vs</p>
        )}
        <p className={cn("truncate", view.match.winner_side === "b" && "font-semibold")}>
          {pairLine(view.sideB)}
        </p>
      </div>

      <div className="mt-3">
        {view.liveStatus === "cerrado" ? null : view.liveStatus === "calentando" ? (
          <Button size="sm" variant="outline" className="w-full" onClick={onStart} disabled={pending}>
            {pending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            Iniciar partido
          </Button>
        ) : (
          <Button size="sm" className="w-full" onClick={onLoadResult} disabled={pending}>
            Cargar resultado
          </Button>
        )}
      </div>

      {streamEnabled && view.liveStatus === "en_juego" && tournamentId && (
        <div className="mt-2">
          <Button
            size="sm"
            variant={isFeatured ? "outline" : "ghost"}
            className="w-full"
            onClick={handleFeature}
            disabled={featuring || isFeatured}
          >
            <Radio className="mr-1 h-3.5 w-3.5" />
            {isFeatured ? "★ Destacado en stream" : "Destacar en stream"}
          </Button>
        </div>
      )}
    </article>
  );
}