import { useState } from "react";
import { ChevronDown, ChevronUp, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTournamentRules } from "@/hooks/useTournamentRules";
import { useTournamentCobrand } from "@/hooks/useTournamentCobrand";
import { RulesMarkdown } from "@/lib/rules-markdown";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface RulesViewProps {
  tournamentId: string;
  tournamentName: string;
}

export const RulesView = ({ tournamentId, tournamentName }: RulesViewProps) => {
  const { rules, loading } = useTournamentRules(tournamentId);
  const { cobrand } = useTournamentCobrand(tournamentId);
  const [guideOpen, setGuideOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const accent = cobrand?.primary_hex || undefined;

  const handleExport = async () => {
    setExporting(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/export-tournament`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ tournament_id: tournamentId, format: "pdf", mode: "rules" }),
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const blob = await res.blob();
      const dl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = dl;
      a.download = `reglamento-${tournamentName.replace(/\s+/g, "-").toLowerCase()}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(dl);
    } catch (err) {
      toast({
        title: "No se pudo exportar",
        description: err instanceof Error ? err.message : "Inténtalo nuevamente",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/50 p-6 text-center text-sm text-muted-foreground">
        Cargando reglamento…
      </div>
    );
  }

  if (!rules) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/50 p-6 text-center text-sm text-muted-foreground">
        El organizador aún no publicó el reglamento de este torneo.
      </div>
    );
  }

  return (
    <article className="space-y-6">
      <header>
        <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-muted-foreground">
          Reglamento · v{rules.version}
        </p>
        <h2 className="mt-2 font-display text-[28px] font-semibold leading-tight">
          <em className="italic" style={accent ? { color: accent } : undefined}>
            {tournamentName}
          </em>
        </h2>
        <div className="mt-3 h-px w-full bg-border" />
      </header>

      {rules.descriptive_md && <RulesMarkdown md={rules.descriptive_md} />}

      {rules.format_table_json && rules.format_table_json.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <tbody>
              {rules.format_table_json.map((row, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="w-1/3 px-4 py-2.5 align-top font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    {row.key}
                  </td>
                  <td className="px-4 py-2.5 align-top text-sm">{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rules.key_rules_md && (
        <Section title="Reglas clave">
          <RulesMarkdown md={rules.key_rules_md} />
        </Section>
      )}

      {rules.tiebreak_rules_md && (
        <Section title="Desempate &amp; premiación">
          <RulesMarkdown md={rules.tiebreak_rules_md} />
        </Section>
      )}

      {rules.player_guide_md && (
        <div className="rounded-2xl border border-border bg-card">
          <button
            type="button"
            onClick={() => setGuideOpen((v) => !v)}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
          >
            <span className="font-mono text-[10px] uppercase tracking-[0.32em] text-muted-foreground">
              Cómo competir · guía jugador
            </span>
            {guideOpen ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
          {guideOpen && (
            <div className="border-t border-border px-4 py-3">
              <RulesMarkdown md={rules.player_guide_md} />
            </div>
          )}
        </div>
      )}

      {rules.image_rights_md && (
        <Section title="Derechos de imagen">
          <RulesMarkdown md={rules.image_rights_md} />
        </Section>
      )}

      <div className="flex flex-col gap-1.5 pt-2">
        <Button onClick={handleExport} variant="outline" disabled={exporting} className="w-full">
          <Download className="mr-2 h-4 w-4" />
          {exporting ? "Generando PDF…" : "Descargar PDF"}
        </Button>
        <p className="text-center text-[10px] text-muted-foreground">
          Publicado el {format(parseISO(rules.created_at), "d 'de' MMMM yyyy", { locale: es })}
        </p>
      </div>
    </article>
  );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section>
    <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.32em] text-muted-foreground">
      {title}
    </p>
    {children}
  </section>
);