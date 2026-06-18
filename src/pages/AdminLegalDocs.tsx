import { useEffect, useState } from "react";
import { ArrowLeft, Plus, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LegalDocViewer } from "@/components/legal/LegalDocViewer";
import { toast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

type Doc = Database["public"]["Tables"]["legal_documents"]["Row"];
type Kind = Database["public"]["Enums"]["legal_doc_kind"];

const KIND_LABEL: Record<Kind, string> = {
  terms: "Términos",
  privacy: "Privacidad",
  user_manual: "Manual",
  rating_explained: "Cómo se calcula el ranking",
  club_regulation: "Reglamento del club",
  other: "Otro",
};

const AdminLegalDocs = () => {
  const { profile } = useAuth();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState<Doc | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    kind: "club_regulation" as Kind,
    title: "",
    content_md: "",
    version: "1.0",
  });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("legal_documents")
      .select("*")
      .order("created_at", { ascending: false });
    setDocs((data ?? []) as Doc[]);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const handleCreate = async () => {
    if (!form.title.trim() || !form.content_md.trim() || !profile) {
      toast({ title: "Faltan campos", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("legal_documents").insert({
      tenant_id: profile.tenant_id,
      kind: form.kind,
      title: form.title.trim().slice(0, 200),
      content_md: form.content_md.slice(0, 50000),
      version: form.version.trim().slice(0, 20),
    });
    setSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    setOpen(false);
    setForm({ kind: "club_regulation", title: "", content_md: "", version: "1.0" });
    toast({ title: "Documento publicado" });
    void load();
  };

  return (
    <div className="min-h-screen bg-gradient-warm pb-12">
      <header className="sticky top-0 z-10 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-md items-center gap-3 px-5 py-4">
          <Link to="/" className="flex h-9 w-9 items-center justify-center rounded-full bg-muted hover:bg-muted/70">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1">
            <h1 className="font-display text-lg font-semibold">Documentos del club</h1>
            <p className="text-[11px] text-muted-foreground">Reglamentos y manuales</p>
          </div>
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="mr-1 h-4 w-4" /> Nuevo
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-md space-y-3 px-5 pt-4">
        {loading ? (
          <p className="text-center text-sm text-muted-foreground">Cargando…</p>
        ) : docs.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
            Sin documentos.
          </p>
        ) : (
          docs.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => setViewing(d)}
              className="block w-full rounded-2xl border border-border bg-card p-4 text-left shadow-card hover:bg-muted"
            >
              <span className="inline-block rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase">
                {KIND_LABEL[d.kind]}
              </span>
              <h3 className="mt-1 font-display text-base font-semibold">{d.title}</h3>
              <p className="text-[11px] text-muted-foreground">
                v{d.version} · {d.tenant_id ? "Club" : "Plataforma"}
              </p>
            </button>
          ))
        )}
      </main>

      {viewing && (
        <LegalDocViewer
          open={!!viewing}
          onOpenChange={(o) => !o && setViewing(null)}
          title={viewing.title}
          contentMd={viewing.content_md}
          version={viewing.version}
        />
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader><DialogTitle>Nuevo documento</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Tipo</Label>
              <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v as Kind })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(KIND_LABEL) as Kind[]).map((k) => (
                    <SelectItem key={k} value={k}>{KIND_LABEL[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="t">Título</Label>
              <Input id="t" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={200} />
            </div>
            <div>
              <Label htmlFor="v">Versión</Label>
              <Input id="v" value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} maxLength={20} />
            </div>
            <div>
              <Label htmlFor="c">Contenido (Markdown)</Label>
              <Textarea
                id="c"
                value={form.content_md}
                onChange={(e) => setForm({ ...form, content_md: e.target.value })}
                rows={12}
                placeholder={"# Reglamento del club\n\n## Vestimenta\n- Zapatillas de tenis obligatorias..."}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
              Publicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminLegalDocs;
