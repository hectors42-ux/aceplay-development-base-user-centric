import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

export default function Login() {
  const { session, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [google, setGoogle] = useState(false);

  useEffect(() => {
    document.title = "Iniciar sesión · AcePlay";
  }, []);

  if (loading) return null;
  if (session) return <Navigate to="/" replace />;

  const onGoogle = async () => {
    setGoogle(true);
    const res = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (res.error) {
      toast.error("No pudimos iniciar sesión con Google");
      setGoogle(false);
    }
  };

  const onMagic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setSending(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    setSending(false);
    if (error) {
      toast.error("No pudimos enviar el enlace");
      return;
    }
    toast.success("Revisa tu correo para entrar");
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 0%, hsl(var(--primary)/0.18), transparent 60%), radial-gradient(ellipse 60% 50% at 80% 100%, hsl(var(--accent)/0.12), transparent 60%)",
        }}
      />
      <Card className="relative w-full max-w-sm border-border/70 bg-card/95 shadow-xl backdrop-blur">
        <CardHeader className="text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-primary">
            Tennis, gamified
          </p>
          <CardTitle className="mt-2 font-display text-4xl leading-none">
            Ace<span className="italic text-primary">Play</span>
          </CardTitle>
          <p className="mt-2 text-sm text-muted-foreground">
            Tu identidad de juego, en cualquier club.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <Button onClick={onGoogle} disabled={google} className="w-full rounded-full" variant="outline">
            {google ? "Redirigiendo…" : "Continuar con Google"}
          </Button>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            <span className="font-mono uppercase tracking-[0.3em]">o</span>
            <span className="h-px flex-1 bg-border" />
          </div>
          <form onSubmit={onMagic} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                Tu correo
              </Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@correo.cl"
                className="h-11 rounded-xl bg-background"
              />
            </div>
            <Button type="submit" className="w-full rounded-full" disabled={sending}>
              {sending ? "Enviando…" : "Enviar enlace mágico"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}