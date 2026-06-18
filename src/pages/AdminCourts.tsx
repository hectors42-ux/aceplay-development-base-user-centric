import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Loader2, Plus, Save, Trash2, TriangleAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import { useClubBrand } from "@/components/providers/ClubBrandProvider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/EmptyState";
import { BookingsProviderCard } from "@/components/admin/BookingsProviderCard";
import { useBookingsProvider } from "@/hooks/useBookingsProvider";
import { toast } from "sonner";

interface CourtRow {
  id: string;
  name: string;
  surface: "arcilla" | "dura" | "cesped" | "sintetico";
  is_indoor: boolean;
  slot_minutes: number;
  opens_at: string;
  closes_at: string;
  sort_order: number;
  is_active: boolean;
}

interface RulesRow {
  max_active_bookings: number;
  max_advance_days: number;
  min_cancel_hours: number;
  allow_back_to_back: boolean;
}

const SURFACES = ["arcilla", "dura", "cesped", "sintetico"] as const;

const AdminCourts = () => {
  const { profile, isAdmin } = useAuth();
  const { brand } = useClubBrand();
  const { isExternal } = useBookingsProvider();
  const [courts, setCourts] = useState<CourtRow[]>([]);
  const [rules, setRules] = useState<RulesRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const tenantId = profile?.tenant_id;

  const loadAll = async () => {
    if (!tenantId) return;
    setLoading(true);
    const [c, r] = await Promise.all([
      supabase
        .from("courts")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("sort_order"),
      supabase
        .from("booking_rules")
        .select("max_active_bookings, max_advance_days, min_cancel_hours, allow_back_to_back")
        .eq("tenant_id", tenantId)
        .maybeSingle(),
    ]);
    setCourts((c.data ?? []) as CourtRow[]);
    setRules(
      (r.data as RulesRow | null) ?? {
        max_active_bookings: 2,
        max_advance_days: 7,
        min_cancel_hours: 4,
        allow_back_to_back: false,
      },
    );
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  const updateCourt = (id: string, patch: Partial<CourtRow>) => {
    setCourts((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };

  const saveCourt = async (court: CourtRow) => {
    setSaving(court.id);
    const { error } = await supabase
      .from("courts")
      .update({
        name: court.name,
        surface: court.surface,
        is_indoor: court.is_indoor,
        slot_minutes: court.slot_minutes,
        opens_at: court.opens_at,
        closes_at: court.closes_at,
        is_active: court.is_active,
      })
      .eq("id", court.id);
    setSaving(null);
    if (error) toast.error(error.message);
    else toast.success(`${court.name} actualizada`);
  };

  const deleteCourt = async (court: CourtRow) => {
    if (!confirm(`¿Eliminar ${court.name}? Las reservas asociadas también se eliminarán.`)) return;
    setSaving(court.id);
    const { error } = await supabase.from("courts").delete().eq("id", court.id);
    setSaving(null);
    if (error) toast.error(error.message);
    else {
      toast.success("Cancha eliminada");
      await loadAll();
    }
  };

  const addCourt = async () => {
    if (!tenantId) return;
    const nextOrder = (courts[courts.length - 1]?.sort_order ?? 0) + 1;
    const { error } = await supabase.from("courts").insert({
      tenant_id: tenantId,
      name: `Cancha ${courts.length + 1}`,
      surface: "arcilla",
      sort_order: nextOrder,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Cancha creada");
      await loadAll();
    }
  };

  const saveRules = async () => {
    if (!tenantId || !rules) return;
    setSaving("rules");
    const { error } = await supabase
      .from("booking_rules")
      .upsert({ tenant_id: tenantId, ...rules }, { onConflict: "tenant_id" });
    setSaving(null);
    if (error) toast.error(error.message);
    else toast.success("Reglas guardadas");
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
          <h1 className="font-display text-3xl font-semibold text-foreground">Canchas y reglas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configura las canchas del club y las reglas de reserva.
          </p>
        </div>

        {/* Proveedor de reservas (encender/apagar el módulo) */}
        <BookingsProviderCard />

        {/* Reglas */}
        {!isExternal && (
        <Card className="rounded-3xl border-border p-6 shadow-card">
          <h2 className="font-display text-lg font-semibold">Reglas de reserva</h2>
          {loading || !rules ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Máximo reservas activas por socio</Label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={rules.max_active_bookings}
                  onChange={(e) =>
                    setRules({ ...rules, max_active_bookings: Number(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Días máximos de antelación</Label>
                <Input
                  type="number"
                  min={1}
                  max={60}
                  value={rules.max_advance_days}
                  onChange={(e) =>
                    setRules({ ...rules, max_advance_days: Number(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Horas mínimas para cancelar</Label>
                <Input
                  type="number"
                  min={0}
                  max={72}
                  value={rules.min_cancel_hours}
                  onChange={(e) =>
                    setRules({ ...rules, min_cancel_hours: Number(e.target.value) })
                  }
                />
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-border bg-muted/30 px-4 py-3">
                <div>
                  <Label>Permitir reservas seguidas</Label>
                  <p className="text-xs text-muted-foreground">
                    Back-to-back en el mismo socio
                  </p>
                </div>
                <Switch
                  checked={rules.allow_back_to_back}
                  onCheckedChange={(v) => setRules({ ...rules, allow_back_to_back: v })}
                />
              </div>
              <div className="sm:col-span-2 flex justify-end">
                <Button variant="clay" onClick={saveRules} disabled={saving === "rules"}>
                  {saving === "rules" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Guardar reglas
                </Button>
              </div>
            </div>
          )}
        </Card>
        )}

        {/* Canchas */}
        <Card className="rounded-3xl border-border p-6 shadow-card">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Canchas</h2>
            <Button variant="outline" size="sm" onClick={addCourt}>
              <Plus className="h-4 w-4" /> Agregar
            </Button>
          </div>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : courts.length === 0 ? (
            <EmptyState
              icon={Plus}
              title="Sin canchas"
              description="Agrega tu primera cancha para empezar a recibir reservas."
              className="mt-4"
            />
          ) : (
            <div className="mt-4 space-y-4">
              {courts.map((c) => (
                <div key={c.id} className="rounded-2xl border border-border bg-muted/20 p-4">
                  <div className="grid gap-3 sm:grid-cols-6">
                    <div className="space-y-1 sm:col-span-2">
                      <Label className="text-xs">Nombre</Label>
                      <Input
                        value={c.name}
                        onChange={(e) => updateCourt(c.id, { name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <Label className="text-xs">Superficie</Label>
                      <Select
                        value={c.surface}
                        onValueChange={(v) => updateCourt(c.id, { surface: v as CourtRow["surface"] })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SURFACES.map((s) => (
                            <SelectItem key={s} value={s} className="capitalize">
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <Label className="text-xs">Duración (min)</Label>
                      <Select
                        value={String(c.slot_minutes)}
                        onValueChange={(v) => updateCourt(c.id, { slot_minutes: Number(v) })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="60">60 min</SelectItem>
                          <SelectItem value="90">90 min</SelectItem>
                          <SelectItem value="120">120 min</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <Label className="text-xs">Abre</Label>
                      <Input
                        type="time"
                        value={c.opens_at.slice(0, 5)}
                        onChange={(e) => updateCourt(c.id, { opens_at: `${e.target.value}:00` })}
                      />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <Label className="text-xs">Cierra</Label>
                      <Input
                        type="time"
                        value={c.closes_at.slice(0, 5)}
                        onChange={(e) => updateCourt(c.id, { closes_at: `${e.target.value}:00` })}
                      />
                    </div>
                    <div className="flex items-center justify-between sm:col-span-2">
                      <div>
                        <Label className="text-xs">Activa</Label>
                        <p className="text-[11px] text-muted-foreground">Visible para socios</p>
                      </div>
                      <Switch
                        checked={c.is_active}
                        onCheckedChange={(v) => updateCourt(c.id, { is_active: v })}
                      />
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteCourt(c)}
                      disabled={saving === c.id}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="clay"
                      size="sm"
                      onClick={() => saveCourt(c)}
                      disabled={saving === c.id}
                    >
                      {saving === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Guardar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </main>
    </div>
  );
};

export default AdminCourts;
