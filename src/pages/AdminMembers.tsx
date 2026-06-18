import { useEffect, useRef, useState } from "react";
import Papa from "papaparse";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  Copy,
  FileUp,
  Loader2,
  TriangleAlert,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import { useClubBrand } from "@/components/providers/ClubBrandProvider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/EmptyState";
import { toast } from "sonner";

type DuesStatus = "al_dia" | "pendiente" | "moroso" | "suspendido";
const DUES_OPTIONS: { value: DuesStatus; label: string }[] = [
  { value: "al_dia", label: "Cuota al día" },
  { value: "pendiente", label: "Pendiente" },
  { value: "moroso", label: "Moroso" },
  { value: "suspendido", label: "Suspendido" },
];

interface ParsedRow {
  email: string;
  first_name: string;
  last_name: string;
  rut?: string;
  phone?: string;
  role?: "member" | "staff" | "club_admin";
}

interface ImportResult {
  email: string;
  status: "invited" | "skipped" | "error";
  reason?: string;
  invitation_url?: string;
}

interface ImportSummary {
  total: number;
  invited: number;
  skipped: number;
  errors: number;
}

interface MemberRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  dues_status: string;
  ntrp_level: number | null;
  member_since: string;
}

interface InvitationRow {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  token: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

const AdminMembers = () => {
  const { profile, isAdmin } = useAuth();
  const { brand } = useClubBrand();
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [invitations, setInvitations] = useState<InvitationRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    if (!profile?.tenant_id) return;
    setLoading(true);
    const [m, i] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, first_name, last_name, email, dues_status, ntrp_level, member_since")
        .eq("tenant_id", profile.tenant_id)
        .order("created_at", { ascending: false }),
      supabase
        .from("member_invitations")
        .select("id, email, first_name, last_name, token, expires_at, accepted_at, created_at")
        .eq("tenant_id", profile.tenant_id)
        .is("accepted_at", null)
        .order("created_at", { ascending: false }),
    ]);
    setMembers((m.data ?? []) as MemberRow[]);
    setInvitations((i.data ?? []) as InvitationRow[]);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.tenant_id]);

  const handleFile = (file: File) => {
    setParsing(true);
    setResults([]);
    setSummary(null);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, "_"),
      complete: (out) => {
        const rows: ParsedRow[] = out.data
          .map((r) => ({
            email: (r.correo || r.email || "").trim().toLowerCase(),
            first_name: (r.nombre || r.first_name || "").trim(),
            last_name: (r.apellido || r.last_name || "").trim(),
            rut: (r.rut || "").trim() || undefined,
            phone: (r.telefono || r["teléfono"] || r.phone || "").trim() || undefined,
            role: (((r.rol || r.role || "member").trim().toLowerCase()) as ParsedRow["role"]) || "member",
          }))
          .filter((r) => r.email);
        setParsed(rows);
        setParsing(false);
        toast.success(`${rows.length} filas leídas del CSV`);
      },
      error: (err) => {
        toast.error(`No se pudo leer el CSV: ${err.message}`);
        setParsing(false);
      },
    });
  };

  const handleImport = async () => {
    if (parsed.length === 0) return;
    setImporting(true);
    const { data, error } = await supabase.functions.invoke("import-members", {
      body: { members: parsed },
    });
    if (error) {
      toast.error(error.message ?? "Error al importar");
    } else {
      setResults(data.results ?? []);
      setSummary(data.summary ?? null);
      toast.success(`Importación completa: ${data.summary?.invited ?? 0} invitaciones nuevas`);
      await loadData();
    }
    setImporting(false);
  };

  const downloadTemplate = () => {
    const csv =
      "correo,nombre,apellido,rut,telefono,rol\n" +
      "socio@ejemplo.cl,Juan,Pérez,12345678-9,+56912345678,member\n";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "plantilla-socios.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success("Link copiado");
  };

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <EmptyState
          icon={TriangleAlert}
          title="Acceso restringido"
          description="Esta sección es solo para administradores del club."
          action={{ label: "Volver al inicio", onClick: () => (window.location.href = "/") }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-warm">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-xl safe-top">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-3">
          <Link
            to="/"
            className="flex items-center gap-2 rounded-xl px-2 py-1 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Inicio
          </Link>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Admin</p>
            <p className="font-display text-base font-semibold text-foreground">{brand.shortName}</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-5 py-6 pb-20">
        <div>
          <h1 className="font-display text-3xl font-semibold text-foreground">Socios</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Importa nóminas y gestiona las invitaciones del club.
          </p>
        </div>

        {/* IMPORT */}
        <Card className="rounded-3xl border-border p-6 shadow-card">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-semibold">Importar desde CSV</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Columnas: <code className="font-mono text-xs">correo, nombre, apellido, rut, telefono, rol</code>
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              Descargar plantilla
            </Button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            <Button
              variant="clay"
              onClick={() => fileRef.current?.click()}
              disabled={parsing}
            >
              {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
              Elegir archivo CSV
            </Button>
            {parsed.length > 0 && (
              <Button onClick={handleImport} disabled={importing} variant="default">
                {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                Crear {parsed.length} invitaciones
              </Button>
            )}
          </div>

          {parsed.length > 0 && results.length === 0 && (
            <p className="mt-3 text-sm text-muted-foreground">
              {parsed.length} filas listas para importar.
            </p>
          )}

          {summary && (
            <div className="mt-4 grid grid-cols-3 gap-3 text-center text-sm">
              <div className="rounded-2xl bg-success/10 p-3">
                <p className="font-display text-2xl font-semibold text-success">{summary.invited}</p>
                <p className="text-xs text-muted-foreground">Invitadas</p>
              </div>
              <div className="rounded-2xl bg-muted p-3">
                <p className="font-display text-2xl font-semibold text-foreground">{summary.skipped}</p>
                <p className="text-xs text-muted-foreground">Omitidas</p>
              </div>
              <div className="rounded-2xl bg-destructive/10 p-3">
                <p className="font-display text-2xl font-semibold text-destructive">{summary.errors}</p>
                <p className="text-xs text-muted-foreground">Errores</p>
              </div>
            </div>
          )}

          {results.length > 0 && (
            <div className="mt-4 max-h-72 overflow-y-auto rounded-2xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Email</th>
                    <th className="px-3 py-2">Estado</th>
                    <th className="px-3 py-2">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="px-3 py-2 font-mono text-xs">{r.email}</td>
                      <td className="px-3 py-2">
                        {r.status === "invited" && (
                          <Badge variant="default" className="gap-1 bg-success text-success-foreground">
                            <Check className="h-3 w-3" /> Invitada
                          </Badge>
                        )}
                        {r.status === "skipped" && (
                          <Badge variant="secondary" className="gap-1">
                            Omitida
                          </Badge>
                        )}
                        {r.status === "error" && (
                          <Badge variant="destructive" className="gap-1">
                            <X className="h-3 w-3" /> Error
                          </Badge>
                        )}
                        {r.reason && <span className="ml-2 text-xs text-muted-foreground">{r.reason}</span>}
                      </td>
                      <td className="px-3 py-2">
                        {r.invitation_url && (
                          <button
                            onClick={() => copyLink(r.invitation_url!)}
                            className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs hover:bg-muted/80"
                          >
                            <Copy className="h-3 w-3" /> Link
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* INVITATIONS PENDING */}
        <Card className="rounded-3xl border-border p-6 shadow-card">
          <h2 className="font-display text-lg font-semibold">Invitaciones pendientes</h2>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : invitations.length === 0 ? (
            <EmptyState
              icon={UserPlus}
              title="Sin invitaciones pendientes"
              description="Importa un CSV para invitar a tus socios."
              className="mt-4"
            />
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {invitations.map((inv) => {
                const url = `${window.location.origin}/accept-invitation?token=${inv.token}`;
                return (
                  <li key={inv.id} className="flex items-center justify-between gap-3 py-3">
                    <div>
                      <p className="font-medium text-foreground">
                        {inv.first_name} {inv.last_name}
                      </p>
                      <p className="text-xs text-muted-foreground">{inv.email}</p>
                    </div>
                    <button
                      onClick={() => copyLink(url)}
                      className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs hover:bg-muted/80"
                    >
                      <Copy className="h-3 w-3" /> Copiar link
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* MEMBERS */}
        <Card className="rounded-3xl border-border p-6 shadow-card">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Socios activos</h2>
            <Badge variant="secondary" className="gap-1">
              <Users className="h-3 w-3" /> {members.length}
            </Badge>
          </div>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : members.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Aún no hay socios activos"
              description="Cuando los invitados acepten su invitación aparecerán aquí."
              className="mt-4"
            />
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {members.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">
                      {m.first_name} {m.last_name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                  </div>
                  <Select
                    value={m.dues_status}
                    onValueChange={async (value) => {
                      const prev = m.dues_status;
                      setMembers((curr) =>
                        curr.map((x) => (x.id === m.id ? { ...x, dues_status: value } : x)),
                      );
                      const { error } = await supabase
                        .from("profiles")
                        .update({ dues_status: value as DuesStatus })
                        .eq("id", m.id);
                      if (error) {
                        setMembers((curr) =>
                          curr.map((x) => (x.id === m.id ? { ...x, dues_status: prev } : x)),
                        );
                        toast.error("No se pudo actualizar el estado de cuota");
                      } else {
                        toast.success("Estado de cuota actualizado");
                      }
                    }}
                  >
                    <SelectTrigger
                      className={`h-8 w-[150px] text-xs ${
                        m.dues_status === "al_dia"
                          ? "border-success/40 bg-success/10 text-success-foreground"
                          : "border-destructive/40 bg-destructive/10 text-destructive"
                      }`}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DUES_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value} className="text-xs">
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </main>
    </div>
  );
};

export default AdminMembers;
