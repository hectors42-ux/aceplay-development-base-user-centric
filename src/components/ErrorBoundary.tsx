import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  children: ReactNode;
  /** Etiqueta para identificar dónde ocurrió el error en los logs. */
  scope?: string;
  /** Render personalizado opcional. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * ErrorBoundary genérico para envolver el shell de la app.
 * Muestra una pantalla recuperable y permite reintentar o cerrar sesión
 * sin necesidad de recargar la página completa.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(
      `[ErrorBoundary${this.props.scope ? `:${this.props.scope}` : ""}] render falló`,
      { message: error.message, stack: error.stack, componentStack: info.componentStack },
    );
  }

  reset = () => this.setState({ error: null });

  signOut = async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      window.location.assign("/auth");
    }
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) return this.props.fallback(error, this.reset);

    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 text-center shadow-lg">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h1 className="font-display text-xl font-semibold text-foreground">
            Algo salió mal
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            No pudimos cargar esta vista. Puedes reintentar o cerrar sesión y volver a entrar.
          </p>
          <pre className="mt-4 max-h-32 overflow-auto rounded-xl bg-muted p-3 text-left text-[11px] text-muted-foreground">
            {error.message}
          </pre>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <Button variant="clay" className="flex-1" onClick={this.reset}>
              <RefreshCw className="mr-2 h-4 w-4" /> Reintentar
            </Button>
            <Button variant="outline" className="flex-1" onClick={this.signOut}>
              <LogOut className="mr-2 h-4 w-4" /> Cerrar sesión
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
