import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { Loader2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import appIcon from "@/assets/brand/app-icon-light.png.asset.json";

interface InvitationView {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  tenant_id: string;
  accepted_at: string | null;
  expires_at: string;
  tenant?: { name: string; short_name: string };
}

const passwordSchema = z.string().min(8, "Mínimo 8 caracteres").max(72);

const AcceptInvitation = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") ?? "";
  const [invitation, setInvitation] = useState<InvitationView | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError("Falta el token de invitación.");
      setLoading(false);
      return;
    }
    const load = async () => {
      const { data, error } = await supabase
        .rpc("get_invitation_by_token", { _token: token })
        .maybeSingle();
      if (error || !data) {
        setError("Invitación no encontrada.");
      } else if (data.accepted_at) {
        setError("Esta invitación ya fue usada. Inicia sesión normalmente.");
      } else if (new Date(data.expires_at) < new Date()) {
        setError("Esta invitación expiró. Pide una nueva al administrador del club.");
      } else {
        setInvitation({
          id: data.id,
          email: data.email,
          first_name: data.first_name,
          last_name: data.last_name,
          tenant_id: data.tenant_id,
          accepted_at: data.accepted_at,
          expires_at: data.expires_at,
          tenant: { name: data.tenant_name, short_name: data.tenant_short_name } as any,
        });
      }
      setLoading(false);
    };
    load();
  }, [token]);

  const handleAccept = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!invitation) return;
    setSubmitting(true);
    const fd = new FormData(e.currentTarget);
    const password = passwordSchema.safeParse(fd.get("password"));
    if (!password.success) {
      toast.error(password.error.errors[0].message);
      setSubmitting(false);
      return;
    }
    const { error } = await supabase.auth.signUp({
      email: invitation.email,
      password: password.data,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { invitation_token: token },
      },
    });
    if (error) {
      toast.error(error.message);
      setSubmitting(false);
    } else {
      toast.success("¡Cuenta activada! Bienvenido al club.");
      setTimeout(() => navigate("/", { replace: true }), 800);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-warm">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-warm px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-3xl bg-gradient-clay shadow-clay">
            <img src={appIcon.url} alt="" className="h-12 w-12 object-contain" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold text-foreground">
              {invitation?.tenant?.name ?? "Club"}
            </h1>
            <p className="text-sm text-muted-foreground">Activación de cuenta de socio</p>
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-card p-6 shadow-card">
          {error ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="outline" onClick={() => navigate("/auth")} className="w-full">
                Ir al login
              </Button>
            </div>
          ) : (
            <form onSubmit={handleAccept} className="space-y-4">
              <div className="rounded-2xl bg-muted/40 p-4 text-sm">
                <p className="flex items-center gap-2 font-medium text-foreground">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  Hola {invitation?.first_name}
                </p>
                <p className="mt-1 text-muted-foreground">
                  Activarás tu cuenta para <span className="font-medium text-foreground">{invitation?.email}</span>.
                  Define una contraseña para continuar.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="accept-password">Contraseña</Label>
                <Input
                  id="accept-password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
                <p className="text-xs text-muted-foreground">Mínimo 8 caracteres.</p>
              </div>
              <Button type="submit" variant="clay" size="lg" className="w-full" disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Activar mi cuenta"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default AcceptInvitation;
