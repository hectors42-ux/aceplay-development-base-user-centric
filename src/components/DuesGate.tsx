import { type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { AlertTriangle, Mail, Phone } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { Button } from "@/components/ui/button";

const DUES_LABEL: Record<string, string> = {
  pendiente: "Cuota pendiente",
  moroso: "Cuota morosa",
  suspendido: "Cuenta suspendida",
};

const DUES_DESCRIPTION: Record<string, string> = {
  pendiente:
    "Tu cuota mensual está pendiente de pago. Regulariza tu situación para volver a usar la app.",
  moroso:
    "Registras pagos vencidos. Acércate a administración para regularizar tu cuota antes de continuar.",
  suspendido:
    "Tu cuenta de socio se encuentra suspendida. Contacta a administración para más información.",
};

/**
 * Bloquea el acceso a la app cuando el socio NO está al día con su cuota.
 * - Admins (club_admin/super_admin) están exentos.
 * - La pantalla de perfil sigue siendo accesible para que vea sus datos.
 */
export const DuesGate = ({ children }: { children: ReactNode }) => {
  const { profile, isAdmin, isCoach, signOut } = useAuth();
  const location = useLocation();

  // Sin perfil aún cargado, admin, coach, o ya está al día → pasar
  // (los coaches no son socios y no están sujetos a cuotas)
  if (!profile || isAdmin || isCoach || profile.dues_status === "al_dia") {
    return <>{children}</>;
  }

  // El usuario puede ver su propio perfil aunque esté pendiente
  if (location.pathname.startsWith("/perfil")) {
    return <>{children}</>;
  }

  const status = profile.dues_status;
  const title = DUES_LABEL[status] ?? "Cuota pendiente";
  const description = DUES_DESCRIPTION[status] ?? DUES_DESCRIPTION.pendiente;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-warm px-5 py-10">
      <div className="w-full max-w-md space-y-5 rounded-3xl border-2 border-destructive/40 bg-card p-7 shadow-elevated">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/15 text-destructive">
            <AlertTriangle className="h-6 w-6" strokeWidth={2.4} />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-destructive">
              Acceso bloqueado
            </p>
            <h1 className="font-display text-2xl font-semibold leading-tight text-foreground">
              {title}
            </h1>
          </div>
        </div>

        <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>

        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-destructive">
            ¿Cómo regularizar?
          </p>
          <ul className="mt-2 space-y-1.5 text-sm text-foreground">
            <li className="flex items-start gap-2">
              <Mail className="mt-0.5 h-4 w-4 flex-shrink-0 text-destructive" />
              <span>Escribe a administración para coordinar el pago.</span>
            </li>
            <li className="flex items-start gap-2">
              <Phone className="mt-0.5 h-4 w-4 flex-shrink-0 text-destructive" />
              <span>O acércate a recepción del club en horario hábil.</span>
            </li>
          </ul>
        </div>

        <div className="flex flex-col gap-2">
          <Link to="/perfil">
            <Button variant="outline" className="w-full">
              Ver mi perfil
            </Button>
          </Link>
          <Button variant="ghost" className="w-full" onClick={() => void signOut()}>
            Cerrar sesión
          </Button>
        </div>
      </div>
    </div>
  );
};
