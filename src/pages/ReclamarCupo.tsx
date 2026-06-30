import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Loader2, Check, Trophy, LogIn, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import { Button } from "@/components/ui/button";

// Reclamo de cupo (Camino B): el jugador abre el enlace de invitación del
// organizador y vincula su cuenta al roster_player. Luego ya puede usar el reto
// vivo. Ruta pública: si no hay sesión, invita a iniciarla.
const ReclamarCupo = () => {
  const { token } = useParams<{ token: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [state, setState] = useState<"idle" | "claiming" | "done" | "error">("idle");
  const [msg, setMsg] = useState<string>("");
  const [result, setResult] = useState<{ category_id: string; slug: string; display_name: string } | null>(null);

  useEffect(() => {
    if (authLoading || !token || !user || state !== "idle") return;
    setState("claiming");
    supabase.rpc("rr_claim_spot", { _token: token }).then(({ data, error }) => {
      if (error) { setState("error"); setMsg(error.message); return; }
      const row = (data as { category_id: string; slug: string; display_name: string }[] | null)?.[0];
      setResult(row ?? null);
      setState("done");
    });
  }, [authLoading, token, user, state]);

  return (
    <div className="grid min-h-screen place-items-center bg-background px-5">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 text-center shadow-card">
        {!user && !authLoading ? (
          <>
            <LogIn className="mx-auto mb-3 h-8 w-8 text-skill" />
            <h1 className="font-display text-xl font-bold text-foreground">Reclama tu lugar</h1>
            <p className="mt-2 text-sm text-muted-foreground">Inicia sesión (o crea tu cuenta) para vincular este cupo del torneo a tu perfil. Luego vuelve a abrir el enlace.</p>
            <Button asChild className="mt-4 w-full bg-action text-action-foreground hover:bg-action/90">
              <Link to="/auth">Iniciar sesión</Link>
            </Button>
          </>
        ) : state === "claiming" || authLoading ? (
          <>
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-skill" />
            <p className="mt-3 text-sm text-muted-foreground">Vinculando tu cuenta…</p>
          </>
        ) : state === "done" ? (
          <>
            <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-confirm/15 text-confirm"><Check className="h-6 w-6" /></span>
            <h1 className="font-display text-xl font-bold text-foreground">¡Lugar reclamado!</h1>
            <p className="mt-2 text-sm text-muted-foreground">Ya eres <span className="font-semibold text-foreground">{result?.display_name}</span> en el torneo. Ahora puedes retar a tus rivales y cargar tus resultados.</p>
            <Button
              className="mt-4 w-full bg-action text-action-foreground hover:bg-action/90"
              onClick={() => navigate(result?.slug ? `/torneos/${result.slug}/cat/${result.category_id}` : "/espacios")}
            >
              <Trophy className="mr-1 h-4 w-4" /> Ir a mi torneo
            </Button>
          </>
        ) : state === "error" ? (
          <>
            <AlertCircle className="mx-auto mb-3 h-8 w-8 text-destructive" />
            <h1 className="font-display text-lg font-bold text-foreground">No se pudo reclamar</h1>
            <p className="mt-2 text-sm text-muted-foreground">{msg}</p>
            <Button asChild variant="outline" className="mt-4 w-full"><Link to="/espacios">Ir a Espacios</Link></Button>
          </>
        ) : null}
      </div>
    </div>
  );
};

export default ReclamarCupo;
