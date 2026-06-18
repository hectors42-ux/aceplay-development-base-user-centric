import { useState } from "react";
import { Download, Link2, MoreHorizontal, Share2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/hooks/use-toast";
import { useShareCardCapture } from "@/hooks/useShareCardCapture";
import type { ShareFormat } from "./ShareCardFrame";
import type { RefObject } from "react";

interface Props {
  captureRef: RefObject<HTMLElement>;
  kind: string;
  shareText: string;
  shareUrl: string;
  cobrandHandle?: string | null;
}

/**
 * Bottom action bar — WhatsApp / Historia / More.
 */
export function ShareActionBar({ captureRef, kind, shareText, shareUrl, cobrandHandle }: Props) {
  const [busyKind, setBusyKind] = useState<string | null>(null);
  const { shareNative, download } = useShareCardCapture(captureRef);

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`;

  const handleWhatsApp = async () => {
    setBusyKind("wa");
    await shareNative({
      format: "square",
      kind,
      text: `${shareText} ${shareUrl}`,
      whatsappUrl,
    });
    setBusyKind(null);
  };

  const handleStory = async () => {
    setBusyKind("story");
    await download({ format: "story", kind });
    toast({
      title: "Imagen lista",
      description: cobrandHandle
        ? `Súbela a tu story · etiqueta a ${cobrandHandle}`
        : "Súbela a tu story de Instagram",
    });
    setBusyKind(null);
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({ title: "Enlace copiado" });
    } catch {
      toast({ title: "No se pudo copiar", variant: "destructive" });
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        size="lg"
        className="flex-1 gap-2 bg-[#25D366] text-white hover:bg-[#1ebd5b]"
        onClick={handleWhatsApp}
        disabled={busyKind !== null}
      >
        <MessageCircle className="h-4 w-4" />
        {busyKind === "wa" ? "Generando…" : "WhatsApp"}
      </Button>
      <Button
        type="button"
        size="lg"
        variant="secondary"
        className="flex-1 gap-2"
        onClick={handleStory}
        disabled={busyKind !== null}
      >
        <Share2 className="h-4 w-4" />
        {busyKind === "story" ? "Generando…" : "Historia"}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" size="lg" variant="outline" aria-label="Más opciones">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="z-[60]">
          <DropdownMenuItem onClick={handleCopyLink}>
            <Link2 className="mr-2 h-4 w-4" /> Copiar enlace
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => download({ format: "square", kind })}>
            <Download className="mr-2 h-4 w-4" /> Descargar 1:1
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => download({ format: "story", kind })}>
            <Download className="mr-2 h-4 w-4" /> Descargar 9:16
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}