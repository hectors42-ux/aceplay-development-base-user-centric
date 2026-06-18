import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useClubBrand } from "@/components/providers/ClubBrandProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import appIcon from "@/assets/brand/app-icon-light.png.asset.json";

const passwordSchema = z
  .string()
  .min(8, "Mínimo 8 caracteres")
  .max(72, "Máximo 72 caracteres");

const ResetPassword = () => {
  const { brand } = useClubBrand();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [recoveryReady, setRecoveryReady] = useState(false);

  useEffect(() => {
    // Supabase emite el evento PASSWORD_RECOVERY cuando el usuario llega
    // desde el enlace del email. Antes de eso, no permitimos cambiar la pass.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setRecoveryReady(true);
    });

    // Si la sesión ya viene activa por el hash, también permitimos.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setRecoveryReady(true);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    const fd = new FormData(e.currentTarget);
    const password = passwordSchema.safeParse(fd.get("password"));
    const confirm = fd.get("confirm");
    if (!password.success) {
      toast.error(password.error.errors[0].message);
      setSubmitting(false);
      return;
    }
    if (password.data !== confirm) {
      toast.error("Las contraseñas no coinciden");
      setSubmitting(false);
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: password.data });
    if (error) {
      toast.error(error.message);
      setSubmitting(false);
      return;
    }
    toast.success("Contraseña actualizada");
    navigate("/", { replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-warm px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-3xl bg-gradient-clay shadow-clay">
            <img src={appIcon.url} alt={brand.name} className="h-12 w-12 object-contain" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold text-foreground">Nueva contraseña</h1>
            <p className="text-sm text-muted-foreground">
              Elige una contraseña segura para tu cuenta
            </p>
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-card p-6 shadow-card">
          {!recoveryReady ? (
            <p className="text-center text-sm text-muted-foreground">
              Verificando enlace de recuperación...
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Nueva contraseña</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
                <p className="text-xs text-muted-foreground">Mínimo 8 caracteres.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">Confirmar contraseña</Label>
                <Input
                  id="confirm"
                  name="confirm"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </div>
              <Button type="submit" variant="clay" size="lg" className="w-full" disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar contraseña"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
