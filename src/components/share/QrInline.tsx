import { useEffect, useState } from "react";
import QRCode from "qrcode";

interface Props {
  url: string;
  size?: number;
  /** Color de módulos (hex). Default: ink. */
  fg?: string;
  /** Color de fondo. Default: white. */
  bg?: string;
}

/**
 * QR inline para share cards. Renderiza un PNG dataURL inline (no usa canvas
 * en runtime) para que `html-to-image` lo capture sin problemas.
 */
export function QrInline({ url, size = 60, fg = "#2b1b12", bg = "#ffffff" }: Props) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(url, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: size * 2,
      color: { dark: fg, light: bg },
    })
      .then((d) => {
        if (!cancelled) setDataUrl(d);
      })
      .catch(() => {
        if (!cancelled) setDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [url, size, fg, bg]);

  if (!dataUrl) {
    return (
      <div
        aria-hidden
        style={{ width: size, height: size, background: bg, borderRadius: 6 }}
      />
    );
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        background: bg,
        padding: 3,
        borderRadius: 8,
        boxShadow: "0 1px 4px rgba(0,0,0,0.18)",
      }}
      aria-label="QR para invitar al torneo"
    >
      <img
        src={dataUrl}
        alt=""
        width={size - 6}
        height={size - 6}
        style={{ display: "block", width: "100%", height: "100%" }}
      />
    </div>
  );
}