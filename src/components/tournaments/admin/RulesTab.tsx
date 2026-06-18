import { useEffect, useState } from "react";
import { AlertTriangle, FileText, Loader2, Plus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useTournamentRules, type RulesPayload } from "@/hooks/useTournamentRules";
import { RULE_TEMPLATES, getRuleTemplate, type FormatTableRow } from "@/lib/tournament-rule-templates";
import { RulesMarkdown } from "@/lib/rules-markdown";
import { toast } from "@/hooks/use-toast";
import { ChevronDown } from "lucide-react";

interface RulesTabProps {
  tournamentId: string;
}

const emptyPayload: RulesPayload = {
  descriptive_md: "",
  format_table_json: [],
  key_rules_md: "",
  tiebreak_rules_md: "",
  player_guide_md: "",
  operator_guide_md: "",
  image_rights_md: "",
};

export const RulesTab = ({ tournamentId }: RulesTabProps) => {
  const { rules, loading, saveDraft, publish } = useTournamentRules(tournamentId);
  const [payload, setPayload] = useState<RulesPayload>(emptyPayload);
  const [busy, setBusy] = useState<null | "draft" | "publish">(null);

  useEffect(() => {
    if (rules) {
      setPayload({
        descriptive_md: rules.descriptive_md ?? "",
        format_table_json: rules.format_table_json ?? [],
        key_rules_md: rules.key_rules_md ?? "",
        tiebreak_rules_md: rules.tiebreak_rules_md ?? "",
        player_guide_md: rules.player_guide_md ?? "",
        operator_guide_md: rules.operator_guide_md ?? "",
        image_rights_md: rules.image_rights_md ?? "",
      });
    }
  }, [rules]);

  const applyTemplate = (key: string) => {
    const t = getRuleTemplate(key);
    if (!t) return;
    setPayload({
      descriptive_md: t.descriptive_md,
      format_table_json: t.format_table_json,
      key_rules_md: t.key_rules_md,
      tiebreak_rules_md: t.tiebreak_rules_md,
      player_guide_md: t.player_guide_md,
      operator_guide_md: t.operator_guide_md,
      image_rights_md: t.image_rights_md,
    });
    toast({ title: `Plantilla "${t.label}" cargada` });
  };

  const updateRow = (idx: number, patch: Partial<FormatTableRow>) => {
    setPayload((p) => ({
      ...p,
      format_table_json: (p.format_table_json ?? []).map((r, i) => (i === idx ? { ...r, ...patch } : r)),
    }));
  };
  const addRow = () =>
    setPayload((p) => ({
      ...p,
      format_table_json: [...(p.format_table_json ?? []), { key: "", value: "" }],
    }));
  const removeRow = (idx: number) =>
    setPayload((p) => ({
      ...p,
      format_table_json: (p.format_table_json ?? []).filter((_, i) => i !== idx),
    }));

  const handleSaveDraft = async () => {
    setBusy("draft");
    try {
      await saveDraft(payload);
      toast({ title: "Borrador guardado" });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Inténtalo nuevamente",
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  };

  const handlePublish = async () => {
    setBusy("publish");
    try {
      const r = await publish(payload);
      toast({ title: `Versión v${r.version} publicada` });
    } catch (err) {
      toast({
        title: "Error al publicar",
        description: err instanceof Error ? err.message : "Inténtalo nuevamente",
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-card px-4 py-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-muted-foreground">
            Reglamento
          </p>
          <p className="text-sm font-semibold">
            {rules ? `Versión actual: v${rules.version}` : "Aún sin publicar"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select onValueChange={applyTemplate}>
            <SelectTrigger className="h-9 w-[220px] text-xs">
              <SelectValue placeholder="Cargar plantilla…" />
            </SelectTrigger>
            <SelectContent>
              {RULE_TEMPLATES.map((t) => (
                <SelectItem key={t.key} value={t.key}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <SectionEditor
            label="Descripción"
            help="Texto introductorio del formato. Acepta **markdown**."
            value={payload.descriptive_md ?? ""}
            onChange={(v) => setPayload((p) => ({ ...p, descriptive_md: v }))}
          />

          <Collapsible defaultOpen>
            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-xl border border-border bg-card px-4 py-2.5 text-left">
              <span className="text-sm font-semibold">Tabla de formato</span>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2 pt-2">
              {(payload.format_table_json ?? []).map((row, idx) => (
                <div key={idx} className="flex gap-2">
                  <Input
                    className="h-9 w-1/3 text-xs"
                    placeholder="Clave"
                    value={row.key}
                    onChange={(e) => updateRow(idx, { key: e.target.value })}
                  />
                  <Input
                    className="h-9 flex-1 text-xs"
                    placeholder="Valor"
                    value={row.value}
                    onChange={(e) => updateRow(idx, { value: e.target.value })}
                  />
                  <Button size="icon" variant="ghost" onClick={() => removeRow(idx)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button size="sm" variant="outline" onClick={addRow}>
                <Plus className="mr-1 h-3 w-3" /> Agregar fila
              </Button>
            </CollapsibleContent>
          </Collapsible>

          <SectionEditor
            label="Reglas clave"
            help="Lista con guiones (`-`). Acepta **markdown**."
            value={payload.key_rules_md ?? ""}
            onChange={(v) => setPayload((p) => ({ ...p, key_rules_md: v }))}
          />
          <SectionEditor
            label="Desempate &amp; premiación"
            help="Cómo se resuelve un empate y qué hay para los ganadores."
            value={payload.tiebreak_rules_md ?? ""}
            onChange={(v) => setPayload((p) => ({ ...p, tiebreak_rules_md: v }))}
          />
          <SectionEditor
            label="Guía del jugador"
            help={'Pasos numerados: `1. **Título**` y descripción en la línea siguiente.'}
            value={payload.player_guide_md ?? ""}
            onChange={(v) => setPayload((p) => ({ ...p, player_guide_md: v }))}
          />
          <SectionEditor
            label="Guía del operador"
            help="Solo visible para operadores y admins."
            value={payload.operator_guide_md ?? ""}
            onChange={(v) => setPayload((p) => ({ ...p, operator_guide_md: v }))}
          />
          <SectionEditor
            label="Derechos de imagen"
            help="Texto que el jugador acepta al inscribirse."
            value={payload.image_rights_md ?? ""}
            onChange={(v) => setPayload((p) => ({ ...p, image_rights_md: v }))}
          />
        </div>

        <div className="space-y-3 lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="mb-3 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.32em] text-muted-foreground">
              <FileText className="h-3 w-3" /> Preview
            </p>
            <div className="max-h-[60vh] space-y-4 overflow-y-auto">
              <RulesMarkdown md={payload.descriptive_md} />
              {(payload.format_table_json ?? []).length > 0 && (
                <div className="overflow-hidden rounded-xl border border-border">
                  <table className="w-full text-xs">
                    <tbody>
                      {(payload.format_table_json ?? []).map((r, i) => (
                        <tr key={i} className="border-b border-border last:border-0">
                          <td className="w-1/3 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                            {r.key}
                          </td>
                          <td className="px-3 py-1.5">{r.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {payload.key_rules_md && (
                <>
                  <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-muted-foreground">Reglas clave</p>
                  <RulesMarkdown md={payload.key_rules_md} />
                </>
              )}
              {payload.tiebreak_rules_md && (
                <>
                  <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-muted-foreground">Desempate</p>
                  <RulesMarkdown md={payload.tiebreak_rules_md} />
                </>
              )}
              {payload.player_guide_md && (
                <>
                  <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-muted-foreground">Guía jugador</p>
                  <RulesMarkdown md={payload.player_guide_md} />
                </>
              )}
              {payload.image_rights_md && (
                <>
                  <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-muted-foreground">Derechos</p>
                  <RulesMarkdown md={payload.image_rights_md} />
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 -mx-5 flex flex-col gap-2 border-t border-border bg-background/95 px-5 py-3 backdrop-blur sm:flex-row">
        <Button variant="outline" onClick={handleSaveDraft} disabled={busy !== null} className="flex-1">
          {busy === "draft" && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
          Guardar borrador
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button disabled={busy !== null} className="flex-1">
              <Upload className="mr-1 h-4 w-4" />
              Publicar nueva versión
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-gold" />
                Publicar nueva versión
              </AlertDialogTitle>
              <AlertDialogDescription>
                Esto creará la versión v{(rules?.version ?? 0) + 1}. Los jugadores que ya
                aceptaron una versión anterior seguirán inscritos, pero los nuevos aceptarán
                esta versión al inscribirse.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handlePublish}>Publicar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

interface SectionEditorProps {
  label: string;
  help: string;
  value: string;
  onChange: (v: string) => void;
}

const SectionEditor = ({ label, help, value, onChange }: SectionEditorProps) => (
  <Collapsible defaultOpen>
    <CollapsibleTrigger className="flex w-full items-center justify-between rounded-xl border border-border bg-card px-4 py-2.5 text-left">
      <span className="text-sm font-semibold">{label}</span>
      <ChevronDown className="h-4 w-4 text-muted-foreground" />
    </CollapsibleTrigger>
    <CollapsibleContent className="space-y-1.5 pt-2">
      <Label className="text-[11px] text-muted-foreground" dangerouslySetInnerHTML={{ __html: help }} />
      <Textarea
        rows={6}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="font-mono text-xs"
      />
    </CollapsibleContent>
  </Collapsible>
);