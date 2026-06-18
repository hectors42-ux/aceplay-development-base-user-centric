import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="font-display text-4xl">404</h1>
      <p className="text-muted-foreground">Esta ruta no existe.</p>
      <Button asChild>
        <Link to="/">Volver al inicio</Link>
      </Button>
    </main>
  );
}