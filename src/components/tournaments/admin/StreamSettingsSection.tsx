import { useEffect, useState } from "react";
import { Radio } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { StreamUrlsCard } from "./StreamUrlsCard";

export function StreamSettingsSection({ tournamentId }: { tournamentId: string }) {
  const [slug, setSlug] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("tournaments")
      .select("slug, is_public_stream_enabled")
      .eq("id", tournamentId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setSlug((data as { slug: string | null } | null)?.slug ?? null);
        setEnabled(Boolean((data as { is_public_stream_enabled?: boolean } | null)?.is_public_stream_enabled));
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [tournamentId]);

  const toggle = async (next: boolean) => {
    setSaving(true);
    const { error } = await supabase
      .from("tournaments")
      .update({ is_public_stream_enabled: next } as never)
      .eq("id", tournamentId);
    setSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    setEnabled(next);
    toast({
      title: next ? "Overlay público activo" : "Overlay público desactivado",
      description: next ? "Las URLs ya pueden usarse en OBS." : "/live/:slug devuelve 404.",
    });
  };

  if (loading) return null;

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.32em] text-muted-foreground">
            <Radio className="h-3.5 w-3.5" /> Streaming
          </p>
          <h3 className="mt-1 font-display text-base font-semibold">Overlay público para OBS</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Activa la ruta pública <span className="font-mono">/live/:slug</span> con la tabla en vivo,
            marcador y lower-third para transmisión.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={enabled} onCheckedChange={toggle} disabled={saving} id="stream-toggle" />
          <Label htmlFor="stream-toggle" className="text-xs">{enabled ? "On" : "Off"}</Label>
        </div>
      </header>

      {enabled && slug && <StreamUrlsCard slug={slug} />}
    </section>
  );
}