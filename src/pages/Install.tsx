import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Download, Share2, MoreVertical, Plus, CheckCircle2, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import appIcon from "@/assets/brand/app-icon-light.png.asset.json";
import { useClubBrand } from "@/components/providers/ClubBrandProvider";

type Platform = "ios" | "android" | "desktop";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const detectPlatform = (): Platform => {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  if (/android/.test(ua)) return "android";
  return "desktop";
};

const isStandalone = () => {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // @ts-expect-error iOS Safari
    window.navigator.standalone === true
  );
};

const Install = () => {
  const platform = useMemo(detectPlatform, []);
  const [installed, setInstalled] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const { brand } = useClubBrand();

  useEffect(() => {
    setInstalled(isStandalone());

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleNativePrompt = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") setInstalled(true);
    setDeferredPrompt(null);
  };

  return (
    <div className="min-h-screen bg-gradient-warm">
      <header className="safe-top sticky top-0 z-30 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-5 pb-3 pt-3">
          <Button asChild variant="ghost" size="icon" className="h-9 w-9">
            <Link to="/" aria-label="Volver al inicio">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <h1 className="font-display text-lg font-semibold">Instalar la app</h1>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 pb-12 pt-4">
        <section className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 flex h-20 w-20 items-center justify-center overflow-hidden rounded-3xl shadow-clay">
            <img src={brand.logoUrl || appIcon.url} alt="" width={80} height={80} className="h-20 w-20 object-cover" />
          </div>
          <h2 className="font-display text-2xl font-semibold leading-tight">
            Tu club, en la pantalla de inicio
          </h2>
          <p className="mt-2 max-w-xs text-sm text-muted-foreground">
            Instala {brand.shortName} en tu teléfono para abrirla con un toque, sin barra del navegador.
          </p>
        </section>

        {installed && (
          <Card className="mb-6 flex items-center gap-3 border-success/30 bg-success/10 p-4">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
            <p className="text-sm font-medium text-foreground">
              ¡Ya tienes la app instalada! Búscala en tu pantalla de inicio.
            </p>
          </Card>
        )}

        {!installed && deferredPrompt && (
          <Card className="mb-6 border-primary/30 bg-primary/5 p-4">
            <div className="mb-3 flex items-center gap-2">
              <Download className="h-5 w-5 text-primary" />
              <p className="text-sm font-semibold">Instalación rápida disponible</p>
            </div>
            <Button onClick={handleNativePrompt} className="w-full" size="lg">
              Instalar ahora
            </Button>
          </Card>
        )}

        <Tabs defaultValue={platform} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="ios">iPhone</TabsTrigger>
            <TabsTrigger value="android">Android</TabsTrigger>
            <TabsTrigger value="desktop">Escritorio</TabsTrigger>
          </TabsList>

          <TabsContent value="ios" className="mt-4">
            <Card className="p-5">
              <p className="mb-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Safari en iPhone / iPad
              </p>
              <ol className="space-y-4">
                <Step
                  n={1}
                  icon={<Share2 className="h-4 w-4" />}
                  title="Toca el botón Compartir"
                  desc="Está en la barra inferior de Safari (un cuadrado con una flecha hacia arriba)."
                />
                <Step
                  n={2}
                  icon={<Plus className="h-4 w-4" />}
                  title='Elige "Agregar a pantalla de inicio"'
                  desc="Desplázate hacia abajo en el menú si no la ves de inmediato."
                />
                <Step
                  n={3}
                  icon={<CheckCircle2 className="h-4 w-4" />}
                  title='Toca "Agregar"'
                  desc={`El icono de ${brand.shortName} aparecerá en tu pantalla de inicio.`}
                />
              </ol>
              <p className="mt-4 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
                💡 Importante: en iPhone debe abrirse desde <strong>Safari</strong>, no desde Chrome ni Instagram.
              </p>
            </Card>
          </TabsContent>

          <TabsContent value="android" className="mt-4">
            <Card className="p-5">
              <p className="mb-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Chrome en Android
              </p>
              <ol className="space-y-4">
                <Step
                  n={1}
                  icon={<MoreVertical className="h-4 w-4" />}
                  title="Toca el menú (⋮) arriba a la derecha"
                  desc="Los tres puntos verticales en la barra de Chrome."
                />
                <Step
                  n={2}
                  icon={<Download className="h-4 w-4" />}
                  title='Elige "Instalar app" o "Agregar a pantalla principal"'
                  desc="El nombre exacto puede variar según tu versión de Chrome."
                />
                <Step
                  n={3}
                  icon={<CheckCircle2 className="h-4 w-4" />}
                  title="Confirma la instalación"
                  desc={`${brand.shortName} quedará disponible como una app más en tu teléfono.`}
                />
              </ol>
            </Card>
          </TabsContent>

          <TabsContent value="desktop" className="mt-4">
            <Card className="p-5">
              <p className="mb-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Chrome / Edge en computador
              </p>
              <ol className="space-y-4">
                <Step
                  n={1}
                  icon={<Smartphone className="h-4 w-4" />}
                  title="Busca el icono de instalar en la barra de direcciones"
                  desc="Ícono de pantalla con una flecha, al final del campo URL."
                />
                <Step
                  n={2}
                  icon={<CheckCircle2 className="h-4 w-4" />}
                  title='Haz clic en "Instalar"'
                  desc={`${brand.shortName} se abrirá en su propia ventana, sin pestañas.`}
                />
              </ol>
              <p className="mt-4 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
                Para la mejor experiencia, te recomendamos instalarla en tu teléfono.
              </p>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="mt-8 text-center">
          <Button asChild variant="outline">
            <Link to="/">Volver al inicio</Link>
          </Button>
        </div>
      </main>
    </div>
  );
};

const Step = ({
  n,
  icon,
  title,
  desc,
}: {
  n: number;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) => (
  <li className="flex gap-3">
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
      {n}
    </div>
    <div className="flex-1">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <span className="text-muted-foreground">{icon}</span>
        {title}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
    </div>
  </li>
);

export default Install;
