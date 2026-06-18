import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

const LAYOUTS: Array<{ key: string; label: string; size: string }> = [
  { key: "standings", label: "Tabla general", size: "1920×1080" },
  { key: "now_playing", label: "Marcador en vivo", size: "1920×1080" },
  { key: "lower_third", label: "Lower third (transparente)", size: "1920×270" },
  { key: "bracket", label: "Bracket (próximamente)", size: "1920×1080" },
];

export function StreamUrlsCard({ slug }: { slug: string }) {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://aceplay.app";
  const copy = (url: string) => {
    void navigator.clipboard.writeText(url).then(() => {
      toast({ title: "Copiado", description: "URL lista para pegar en OBS." });
    });
  };
  return (
    <div className="space-y-2">
      {LAYOUTS.map((l) => {
        const url = `${origin}/live/${slug}?layout=${l.key}`;
        return (
          <div key={l.key} className="rounded-xl border border-border bg-card p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold">{l.label}</p>
                <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">{l.size}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => copy(url)}>
                <Copy className="mr-1 h-3.5 w-3.5" />
                Copiar
              </Button>
            </div>
            <p className="mt-2 truncate font-mono text-[11px] text-muted-foreground">{url}</p>
          </div>
        );
      })}
    </div>
  );
}