import { useCallback, useState, type RefObject } from "react";
import { toPng } from "html-to-image";
import { toast } from "@/hooks/use-toast";
import { trackEvent } from "@/lib/analytics";
import type { ShareFormat } from "@/components/share/ShareCardFrame";
import { SHARE_DIM } from "@/components/share/ShareCardFrame";

interface CaptureOptions {
  format: ShareFormat;
  filename?: string;
  kind: string;
}

async function ensureFonts() {
  if (typeof document === "undefined") return;
  // Best-effort: las fuentes ya están cargadas globalmente. Esperamos a que
  // el browser confirme antes de capturar para evitar fallback fonts.
  if (document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      /* ignore */
    }
  }
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, b64] = dataUrl.split(",");
  const mime = meta.match(/data:(.*?);/)?.[1] ?? "image/png";
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

export function useShareCardCapture(ref: RefObject<HTMLElement>) {
  const [busy, setBusy] = useState(false);

  const capture = useCallback(async ({ format }: { format: ShareFormat }) => {
    if (!ref.current) throw new Error("Sin referencia para capturar");
    await ensureFonts();
    const { width, height } = SHARE_DIM[format];
    return toPng(ref.current, {
      pixelRatio: 2,
      cacheBust: false,
      width,
      height,
      backgroundColor: "#1f1612",
    });
  }, [ref]);

  const download = useCallback(
    async (opts: CaptureOptions) => {
      setBusy(true);
      try {
        const url = await capture({ format: opts.format });
        const link = document.createElement("a");
        link.download = opts.filename ?? `aceplay-${opts.kind}-${opts.format}.png`;
        link.href = url;
        link.click();
        trackEvent("share_card_downloaded", { kind: opts.kind, format: opts.format });
      } catch (err) {
        console.error("[share] download", err);
        toast({ title: "No se pudo generar la imagen", variant: "destructive" });
      } finally {
        setBusy(false);
      }
    },
    [capture],
  );

  const shareNative = useCallback(
    async (opts: CaptureOptions & { text: string; whatsappUrl?: string }) => {
      setBusy(true);
      try {
        const url = await capture({ format: opts.format });
        const blob = dataUrlToBlob(url);
        const file = new File(
          [blob],
          opts.filename ?? `aceplay-${opts.kind}-${opts.format}.png`,
          { type: "image/png" },
        );
        const nav = navigator as Navigator & {
          canShare?: (data: ShareData) => boolean;
        };
        const shareData: ShareData = { files: [file], text: opts.text };
        if (nav.share && nav.canShare?.(shareData)) {
          await nav.share(shareData);
          trackEvent("share_card_shared", { kind: opts.kind, channel: "native" });
        } else if (opts.whatsappUrl) {
          window.location.href = opts.whatsappUrl;
          trackEvent("share_card_shared", { kind: opts.kind, channel: "whatsapp" });
        } else {
          // Fallback final: descargar
          const link = document.createElement("a");
          link.download = file.name;
          link.href = url;
          link.click();
          trackEvent("share_card_downloaded", { kind: opts.kind, format: opts.format });
        }
      } catch (err) {
        if ((err as DOMException)?.name === "AbortError") return;
        console.error("[share] native", err);
        toast({ title: "No se pudo compartir", variant: "destructive" });
      } finally {
        setBusy(false);
      }
    },
    [capture],
  );

  return { busy, download, shareNative };
}