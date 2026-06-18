import type { ReactNode } from "react";
import { Flag } from "@/components/tournaments/cobrand/Flag";
import type { TournamentCobrand } from "@/hooks/useTournamentCobrand";
import { WatermarkFooter } from "./WatermarkFooter";

export type ShareFormat = "story" | "square";

interface Props {
  format: ShareFormat;
  cobrand: TournamentCobrand | null | undefined;
  handle: string;
  inviteUrl: string;
  children: ReactNode;
}

export const SHARE_DIM = {
  story: { width: 540, height: 960 },
  square: { width: 540, height: 540 },
} as const;

/**
 * Frame común de todas las share cards.
 * Dimensiones lógicas 540×960 (story) / 540×540 (square).
 * Captura final con pixelRatio=2 → 1080×1920 / 1080×1080.
 */
export function ShareCardFrame({ format, cobrand, handle, inviteUrl, children }: Props) {
  const { width, height } = SHARE_DIM[format];
  const gradient =
    cobrand?.gradient_css ||
    cobrand?.primary_hex ||
    "linear-gradient(160deg, hsl(82 32% 22%) 0%, hsl(16 62% 44%) 100%)";

  return (
    <div
      data-share-card
      className="relative overflow-hidden text-white"
      style={{
        width,
        height,
        background: gradient,
        fontFamily: "'DM Sans', system-ui, sans-serif",
      }}
    >
      <div className="pointer-events-none absolute -right-16 -top-20 h-72 w-72 rounded-full bg-white/8" />
      <div className="pointer-events-none absolute -bottom-10 -left-10 h-48 w-48 rounded-full bg-white/5" />

      <div className="relative flex h-full flex-col px-7 pb-6 pt-7">
        <div
          className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.32em] text-white/85"
          style={{ fontFamily: "'DM Mono', monospace" }}
        >
          <Flag countryCode={cobrand?.flag_country} size={12} />
          <span>
            {cobrand?.lockup_text ??
              (cobrand ? `ACEPLAY × ${cobrand.display_name.toUpperCase()}` : "ACEPLAY")}
          </span>
        </div>
        {cobrand?.eyebrow_text && (
          <p className="mt-1 font-display text-xs italic text-white/75">
            {cobrand.eyebrow_text}
          </p>
        )}

        <div className="flex flex-1 flex-col">{children}</div>

        <WatermarkFooter
          handle={handle}
          cobrandName={cobrand?.display_name}
          flagCountry={cobrand?.flag_country}
          inviteUrl={inviteUrl}
        />
      </div>
    </div>
  );
}