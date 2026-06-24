import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/components/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

const emailSchema = z.string().trim().email("Email inválido").max(255);
const passwordSchema = z.string().min(8, "Mínimo 8 caracteres").max(72, "Máximo 72 caracteres");
const nameSchema = z.string().trim().min(1, "Requerido").max(80);

// ── Logos de proveedor (solo-icono) ─────────────────────────────────────────
const GoogleIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);
const AppleIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
    <path d="M16.365 1.43c0 1.14-.42 2.22-1.22 3.04-.86.89-2.27 1.58-3.43 1.49-.14-1.13.42-2.31 1.18-3.07.86-.86 2.32-1.51 3.47-1.46zM20.5 17.34c-.57 1.31-.84 1.9-1.57 3.06-1.02 1.62-2.46 3.64-4.24 3.66-1.59.02-2-1.04-4.16-1.03-2.16.01-2.61 1.05-4.2 1.03-1.78-.02-3.14-1.84-4.16-3.46-2.85-4.51-3.15-9.81-1.39-12.62 1.25-1.99 3.22-3.16 5.07-3.16 1.88 0 3.07 1.03 4.62 1.03 1.51 0 2.43-1.03 4.6-1.03 1.65 0 3.39.9 4.64 2.46-4.08 2.24-3.41 8.07.79 10.06z" />
  </svg>
);

// ── Splash "The Serve": el arco se dibuja solo y luego Rally cae ─────────────
const SplashMark = () => {
  const reduced = useReducedMotion();
  return (
    <div className="relative h-28 w-44">
      <svg viewBox="0 0 200 130" className="h-full w-full overflow-visible" role="img" aria-label="AcePlay">
        <defs>
          <radialGradient id="auth-ball" cx="38%" cy="32%" r="78%">
            <stop offset="0%" stopColor="#e8ff8a" />
            <stop offset="55%" stopColor="#c6f23a" />
            <stop offset="100%" stopColor="#9fce10" />
          </radialGradient>
        </defs>
        {/* arco "The Serve" — se dibuja solo */}
        <motion.path
          d="M26 106 Q66 22 150 44"
          fill="none"
          stroke="hsl(var(--action))"
          strokeWidth="13"
          strokeLinecap="round"
          initial={reduced ? false : { pathLength: 0, opacity: 0.4 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={reduced ? { duration: 0 } : { duration: 0.9, ease: [0.2, 0.9, 0.3, 1] }}
          style={{ filter: "drop-shadow(0 6px 16px hsl(var(--action) / 0.45))" }}
        />
        {/* Rally cae al final del arco */}
        <motion.g
          initial={reduced ? false : { y: -130, opacity: 0, scale: 0.5 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          transition={reduced ? { duration: 0 } : { delay: 0.8, type: "spring", stiffness: 320, damping: 13 }}
        >
          <g transform="translate(122 16) scale(0.56)">
            <circle cx="50" cy="50" r="46" fill="url(#auth-ball)" stroke="#86b00a" strokeWidth="1.5" />
            <path d="M14 30 Q50 50 14 70" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" opacity=".95" />
            <path d="M86 30 Q50 50 86 70" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" opacity=".95" />
            <ellipse cx="40" cy="48" rx="6" ry="7.5" fill="#fff" />
            <ellipse cx="60" cy="48" rx="6" ry="7.5" fill="#fff" />
            <circle cx="41" cy="49" r="3.2" fill="#16271a" />
            <circle cx="61" cy="49" r="3.2" fill="#16271a" />
            <path d="M40 64 Q50 73 60 64" fill="none" stroke="#16271a" strokeWidth="3" strokeLinecap="round" />
          </g>
        </motion.g>
      </svg>
    </div>
  );
};

const Auth = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const redirectTo = params.get("redirect") || "/";
  const [submitting, setSubmitting] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSubmitting, setForgotSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate(redirectTo, { replace: true });
  }, [user, loading, navigate, redirectTo]);

  const handleForgotPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const email = emailSchema.safeParse(forgotEmail);
    if (!email.success) {
      toast.error(email.error.errors[0].message);
      return;
    }
    setForgotSubmitting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.data, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setForgotSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Si el email existe, te enviamos un enlace para restablecer la contraseña.");
    setForgotOpen(false);
    setForgotEmail("");
  };

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    const fd = new FormData(e.currentTarget);
    const email = emailSchema.safeParse(fd.get("email"));
    const password = z.string().min(1, "Requerido").safeParse(fd.get("password"));
    if (!email.success || !password.success) {
      toast.error(email.error?.errors[0]?.message || password.error?.errors[0]?.message || "Datos inválidos");
      setSubmitting(false);
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({ email: email.data, password: password.data });
    if (error) {
      toast.error(error.message === "Invalid login credentials" ? "Credenciales incorrectas" : error.message);
    } else {
      toast.success("¡Bienvenido!");
    }
    setSubmitting(false);
  };

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    const fd = new FormData(e.currentTarget);
    const first = nameSchema.safeParse(fd.get("first_name"));
    const last = nameSchema.safeParse(fd.get("last_name"));
    const email = emailSchema.safeParse(fd.get("email"));
    const password = passwordSchema.safeParse(fd.get("password"));
    if (!first.success || !last.success || !email.success || !password.success) {
      toast.error(
        first.error?.errors[0]?.message ||
          last.error?.errors[0]?.message ||
          email.error?.errors[0]?.message ||
          password.error?.errors[0]?.message ||
          "Datos inválidos",
      );
      setSubmitting(false);
      return;
    }

    const displayName = `${first.data} ${last.data}`.trim();
    const { data, error } = await supabase.auth.signUp({
      email: email.data,
      password: password.data,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { display_name: displayName, handle: email.data.split("@")[0] },
      },
    });
    setSubmitting(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    if (data.session) {
      toast.success("¡Cuenta creada! Vamos a tu nivel inicial.");
    } else {
      toast.success("Cuenta creada. Revisa tu email para confirmar el acceso.");
    }
  };

  const handleGoogle = async () => {
    setSubmitting(true);
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: `${window.location.origin}/` });
    if (result.error) {
      toast.error("No se pudo iniciar sesión con Google");
      setSubmitting(false);
    }
  };

  const handleApple = async () => {
    setSubmitting(true);
    const result = await lovable.auth.signInWithOAuth("apple", { redirect_uri: `${window.location.origin}/` });
    if (result.error) {
      toast.error("No se pudo iniciar sesión con Apple");
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-5 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(120% 90% at 50% -10%, #16213C 0%, #0A1020 42%, #070B16 100%)" }}
      />
      <div className="relative z-10 w-full max-w-sm space-y-7">
        {/* Splash de marca: arco + Rally con motion */}
        <div className="flex flex-col items-center text-center">
          <SplashMark />
          <h1 className="mt-1 font-cormorant text-4xl font-semibold leading-none tracking-tight">
            <span className="text-foreground">Ace</span>
            <span className="italic text-action">Play</span>
          </h1>
          <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.32em] text-muted-foreground">— Tennis, gamified</p>
        </div>

        <div className="rounded-3xl border border-border bg-card/80 p-6 shadow-elevated backdrop-blur">
          <Tabs defaultValue="signin">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Registrarse</TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="mt-4">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email</Label>
                  <Input id="signin-email" name="email" type="email" autoComplete="email" required />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="signin-password">Contraseña</Label>
                    <button
                      type="button"
                      onClick={() => setForgotOpen(true)}
                      className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                  </div>
                  <PasswordInput id="signin-password" name="password" autoComplete="current-password" required />
                </div>
                <Button type="submit" variant="clay" size="lg" className="w-full" disabled={submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Entrar a la arena"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="mt-4">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="signup-first">Nombre</Label>
                    <Input id="signup-first" name="first_name" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-last">Apellido</Label>
                    <Input id="signup-last" name="last_name" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input id="signup-email" name="email" type="email" autoComplete="email" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Contraseña</Label>
                  <PasswordInput id="signup-password" name="password" autoComplete="new-password" minLength={8} required />
                  <p className="text-xs text-muted-foreground">Mínimo 8 caracteres.</p>
                </div>
                <Button type="submit" variant="clay" size="lg" className="w-full" disabled={submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crear mi cuenta"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="my-5 flex items-center gap-3 text-[10px] uppercase tracking-wider text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            <span>o continúa con</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {/* OAuth solo-icono (se sobreentiende que son botones de acceso) */}
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={handleGoogle}
              disabled={submitting}
              aria-label="Continuar con Google"
              className="grid h-12 w-12 place-items-center rounded-2xl border border-border bg-background transition-smooth hover:bg-muted disabled:opacity-50"
            >
              <GoogleIcon className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={handleApple}
              disabled={submitting}
              aria-label="Continuar con Apple"
              className="grid h-12 w-12 place-items-center rounded-2xl border border-border bg-background text-foreground transition-smooth hover:bg-muted disabled:opacity-50"
            >
              <AppleIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        <p className="text-center font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground/70">
          El arco es el saque · tu progresión
        </p>
      </div>

      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restablecer contraseña</DialogTitle>
            <DialogDescription>
              Ingresa tu email y te enviaremos un enlace para restablecer la contraseña.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="forgot-email">Email</Label>
              <Input
                id="forgot-email"
                type="email"
                autoComplete="email"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setForgotOpen(false)} disabled={forgotSubmitting}>
                Cancelar
              </Button>
              <Button type="submit" variant="clay" disabled={forgotSubmitting}>
                {forgotSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar enlace"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Auth;
