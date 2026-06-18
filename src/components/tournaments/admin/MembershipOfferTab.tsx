import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

type OfferType = "trial_30d" | "discount_first_month" | "free_first_class";

interface Offer {
  tournament_id: string;
  offer_type: OfferType;
  offer_label: string;
  offer_terms_md: string | null;
  active: boolean;
  expires_at: string | null;
}

const TYPE_LABEL: Record<OfferType, string> = {
  trial_30d: "Trial 30 días",
  discount_first_month: "Descuento primer mes",
  free_first_class: "Clase gratis",
};

interface Props {
  tournamentId: string;
}

export function MembershipOfferTab({ tournamentId }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [type, setType] = useState<OfferType>("trial_30d");
  const [label, setLabel] = useState("");
  const [terms, setTerms] = useState("");
  const [active, setActive] = useState(true);
  const [expiresAt, setExpiresAt] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("tournament_membership_offer" as never)
        .select("*")
        .eq("tournament_id", tournamentId)
        .maybeSingle();
      if (cancelled) return;
      const o = data as Offer | null;
      if (o) {
        setType(o.offer_type);
        setLabel(o.offer_label);
        setTerms(o.offer_terms_md ?? "");
        setActive(o.active);
        setExpiresAt(o.expires_at ? o.expires_at.slice(0, 10) : "");
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [tournamentId]);

  const handleSave = async () => {
    if (!label.trim()) {
      toast({ title: "Falta la etiqueta", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      tournament_id: tournamentId,
      offer_type: type,
      offer_label: label.trim(),
      offer_terms_md: terms.trim() || null,
      active,
      expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
    };
    const { error } = await supabase
      .from("tournament_membership_offer" as never)
      .upsert(payload as never, { onConflict: "tournament_id" });
    setSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Oferta guardada" });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 rounded-2xl border bg-card p-5">
      <div>
        <h3 className="font-display text-lg">Captación de socios</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          La oferta aparece en la tarjeta de perfil del torneo cuando un invitado la abre.
          Sin oferta activa, no se muestra ningún CTA.
        </p>
      </div>

      <div className="space-y-3">
        <Label className="text-xs uppercase tracking-wider">Tipo de oferta</Label>
        <RadioGroup value={type} onValueChange={(v) => setType(v as OfferType)}>
          {(Object.keys(TYPE_LABEL) as OfferType[]).map((k) => (
            <div key={k} className="flex items-center gap-2">
              <RadioGroupItem value={k} id={`offer-${k}`} />
              <Label htmlFor={`offer-${k}`} className="cursor-pointer">
                {TYPE_LABEL[k]}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>

      <div className="space-y-2">
        <Label>Etiqueta corta</Label>
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          maxLength={120}
          placeholder="30 días gratis para jugar la próxima americana"
        />
      </div>

      <div className="space-y-2">
        <Label>Condiciones (markdown)</Label>
        <Textarea
          value={terms}
          onChange={(e) => setTerms(e.target.value)}
          rows={6}
          maxLength={2000}
          placeholder="- Válido para nuevos socios&#10;- 2 reservas de cancha por mes&#10;..."
        />
      </div>

      <div className="flex items-center justify-between">
        <Label htmlFor="offer-active">Activa</Label>
        <Switch id="offer-active" checked={active} onCheckedChange={setActive} />
      </div>

      <div className="space-y-2">
        <Label>Expira (opcional)</Label>
        <Input
          type="date"
          value={expiresAt}
          onChange={(e) => setExpiresAt(e.target.value)}
        />
      </div>

      <Button onClick={handleSave} disabled={saving} className="w-full">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar oferta"}
      </Button>
    </div>
  );
}