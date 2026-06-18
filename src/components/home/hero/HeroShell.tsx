import { ReactNode } from "react";
import { Sparkles, AlertTriangle } from "lucide-react";
import heroTerreBattue from "@/assets/brand/hero-terre-battue.png.asset.json";
import heroUsOpen from "@/assets/brand/hero-us-open.png.asset.json";
import heroWimbledon from "@/assets/brand/hero-wimbledon.png.asset.json";
import { useAuth } from "@/components/providers/AuthProvider";
import { useTheme } from "@/contexts/ThemeContext";

const HERO_BY_THEME = {
  "terre-battue": heroTerreBattue.url,
  "us-open": heroUsOpen.url,
  wimbledon: heroWimbledon.url,
} as const;

const DUES_CHIP_LABEL: Record<string, string> = {
  al_dia: "Cuota al día",
  pendiente: "Cuota pendiente",
  moroso: "Cuota morosa",
  suspendido: "Cuenta suspendida",
};

/**
 * Carcasa común de todos los heros del Home: fondo aéreo, overlay clay,
 * chip de cuotas y slot para contenido. Garantiza consistencia visual entre
 * HeroBookingNext / HeroTournament / HeroMatchupOfTheWeek / HeroSuggestedRival / HeroIdle.
 */
export const HeroShell = ({ children }: { children: ReactNode }) => {
  const { profile, isCoach } = useAuth();
  const { theme } = useTheme();
  const heroSrc = HERO_BY_THEME[theme] ?? heroTerreBattue.url;
  const dues = profile?.dues_status ?? "al_dia";
  const duesAtDay = dues === "al_dia";
  const duesLabel = DUES_CHIP_LABEL[dues] ?? "Cuota al día";
  const DuesIcon = duesAtDay ? Sparkles : AlertTriangle;
  const duesChipClass = duesAtDay
    ? "bg-white/10 text-white"
    : "bg-destructive/70 text-destructive-foreground";
  const showDuesChip = !isCoach;

  return (
    <section className="px-5">
      <div className="relative overflow-hidden rounded-[14px] shadow-elevated">
        <img
          key={heroSrc}
          src={heroSrc}
          alt="Cancha del club"
          width={1024}
          height={1024}
          loading="eager"
          decoding="async"
          // @ts-expect-error fetchpriority is valid HTML but missing from React types
          fetchpriority="high"
          className="absolute inset-0 h-full w-full object-cover animate-in fade-in duration-500"
        />
        <div className="absolute inset-0 bg-gradient-overlay" />
        <div className="absolute inset-0 bg-gradient-to-br from-primary-deep/50 via-transparent to-transparent" />

        <div className="relative flex min-h-[260px] flex-col justify-end gap-4 p-6 md:min-h-[300px] md:p-8">
          {showDuesChip && (
            <div className="absolute right-4 top-4">
              <div
                className={`inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider backdrop-blur-md ${duesChipClass}`}
              >
                <DuesIcon className="h-2.5 w-2.5" strokeWidth={2.5} />
                {duesLabel}
              </div>
            </div>
          )}
          {children}
        </div>
      </div>
    </section>
  );
};

export const HeroSkeleton = () => (
  <HeroShell>
    <div className="h-24 animate-pulse rounded-2xl bg-white/10" />
  </HeroShell>
);
