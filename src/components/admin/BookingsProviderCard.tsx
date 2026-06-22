import { useEffect, useState } from "react";
import { Loader2, Save, ExternalLink, Building2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { EXTERNAL_BOOKING_COPY } from "@/lib/external-bookings-copy";

type Provider = "internal" | "external";

export const BookingsProviderCard = () => {
  const { profile } = useAuth();
  const tenantId = profile?.tenant_id ?? null;
  const qc = useQueryClient();

  const [provider, setProvider] = useState<Provider>("internal");
  const [url, setUrl] = useState("");
  const [initialProvider, setInitialProvider] = useState<Provider>("internal");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("tenants")
        .select("bookings_provider, external_booking_url")
        .eq("id", tenantId)
        .maybeSingle();
      const p = ((data as any)?.bookings_provider ?? "internal") as Provider;
      setProvider(p);
      setInitialProvider(p);
      setUrl((data as any)?.external_booking_url ?? "");
      setLoading(false);
    })();
  }, [tenantId]);

  const persist = async () => {
    if (!tenantId) return;
    if (provider === "external" && !/^https?:\/\//i.test(url.trim())) {
      toast.error("Ingresa una URL válida que comience con https://");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("tenants")
      .update({
        bookings_provider: provider,
        external_booking_url: provider === "external" ? url.trim() : null,
      } as any)
      .eq("id", tenantId);
    setSaving(false);
    if (error) {
      toast.error(error.message ?? "No se pudo guardar");
      return;
    }
    setInitialProvider(provider);
    void qc.invalidateQueries({ queryKey: ["bookings-provider"] });
    void supabase.from("analytics_events").insert({
      tenant_id: tenantId,
      user_id: profile?.user_id ?? null,
      event_name: "bookings_provider_changed",
      event_props: { provider, url: provider === "external" ? url.trim() : null },
    } as any);
    toast.success(
      provider === "external"
        ? EXTERNAL_BOOKING_COPY.adminToastEnabled
        : EXTERNAL_BOOKING_COPY.adminToastDisabled,
    );
  };

  const handleSave = () => {
    if (provider === "external" && initialProvider === "internal") {
      setConfirmOpen(true);
      return;
    }
    void persist();
  };

  const dirty = provider !== initialProvider || (provider === "external" && url.trim() !== "");

  return (
    <Card className="rounded-3xl border-border p-6 shadow-card">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Building2 className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-semibold">Módulo de reservas</h2>
          <p className="text-xs text-muted-foreground">
            Decide si los socios reservan dentro de la app o son redirigidos a un proveedor externo.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : (
        <div className="mt-5 space-y-5">
          <RadioGroup
            value={provider}
            onValueChange={(v) => setProvider(v as Provider)}
            className="grid gap-3 md:grid-cols-2"
          >
            <Label
              htmlFor="prov-internal"
              className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-smooth ${
                provider === "internal" ? "border-primary bg-primary/5" : "border-border"
              }`}
            >
              <RadioGroupItem value="internal" id="prov-internal" className="mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">Reservas internas</p>
                <p className="text-xs text-muted-foreground">
                  Los socios reservan canchas, ven disponibilidad y cancelan dentro de la app.
                </p>
              </div>
            </Label>
            <Label
              htmlFor="prov-external"
              className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-smooth ${
                provider === "external" ? "border-primary bg-primary/5" : "border-border"
              }`}
            >
              <RadioGroupItem value="external" id="prov-external" className="mt-0.5" />
              <div className="space-y-1">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  Reservas externas <ExternalLink className="h-3.5 w-3.5" />
                </p>
                <p className="text-xs text-muted-foreground">
                  Cualquier acción de "Reservar" abre la URL del proveedor en una nueva pestaña.
                </p>
              </div>
            </Label>
          </RadioGroup>

          {provider === "external" && (
            <div className="space-y-2">
              <Label htmlFor="prov-url">URL del proveedor externo</Label>
              <Input
                id="prov-url"
                type="url"
                placeholder="https://www.easycancha.com/book/search"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                inputMode="url"
              />
              <p className="text-[11px] text-muted-foreground">
                Se abrirá en pestaña nueva con <code>noopener</code>. Reversible en cualquier momento.
              </p>
            </div>
          )}

          <div className="flex justify-end">
            <Button
              variant="clay"
              onClick={handleSave}
              disabled={saving || (!dirty && provider === initialProvider)}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Guardar
            </Button>
          </div>
        </div>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar reservas internas</AlertDialogTitle>
            <AlertDialogDescription>
              A partir de ahora todos los botones "Reservar" abrirán la URL externa en una
              pestaña nueva. Se ocultarán "Mis reservas", la próxima reserva en el Home y los
              indicadores de ocupación de cancha. Las clases, torneos y la Escalerilla siguen
              funcionando con normalidad. Esta acción es reversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmOpen(false);
                void persist();
              }}
            >
              Activar reservas externas
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};
