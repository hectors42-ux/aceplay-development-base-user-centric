import { useState } from "react";
import { Navigate } from "react-router-dom";
import { RecentMatchesCarousel } from "@/components/ranking/RecentMatchesCarousel";
import { StatRing } from "@/components/profile/StatRing";
import { Last10StreakRing } from "@/components/profile/Last10StreakRing";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { ProfileSummaryRecentMatch } from "@/hooks/useUserProfileSummary";

/**
 * /dev/preview — solo accesible en desarrollo.
 * Muestra el RecentMatchesCarousel en frames de mobile, tablet y desktop
 * para verificar el layout responsive antes de publicar.
 */

const isoDaysAgo = (d: number) => new Date(Date.now() - d * 86400000).toISOString();

const RAW: Array<Omit<ProfileSummaryRecentMatch, "level_after" | "source_ref_id" | "opponent_id">> = [
  {
    id: "1",
    source: "tournament_match",
    delta: 0.09,
    won: true,
    recorded_at: isoDaysAgo(2),
    opponent_name: "Vicente Cifuentes",
    opponent_avatar: null,
    score_summary: "6-4, 7-5",
    partner_name: null,
  },
  {
    id: "2",
    source: "ladder_challenge",
    delta: -0.09,
    won: false,
    recorded_at: isoDaysAgo(5),
    opponent_name: "Carla Pérez",
    opponent_avatar: null,
    score_summary: "6-4, 4-6, 3-6",
    partner_name: null,
  },
  {
    id: "3",
    source: "match_open",
    delta: 0.05,
    won: true,
    recorded_at: isoDaysAgo(8),
    opponent_name: "Diego Soto",
    opponent_avatar: null,
    score_summary: null,
    partner_name: "Pedro Ramírez",
  },
  {
    id: "4",
    source: "clase",
    delta: 0.02,
    won: true,
    recorded_at: isoDaysAgo(10),
    opponent_name: undefined,
    opponent_avatar: null,
    score_summary: null,
    partner_name: null,
  },
  {
    id: "5",
    source: "onboarding",
    delta: 0,
    won: true,
    recorded_at: isoDaysAgo(30),
    opponent_name: undefined,
    opponent_avatar: null,
    score_summary: null,
    partner_name: null,
  },
  {
    id: "6",
    source: "decay",
    delta: -0.05,
    won: false,
    recorded_at: isoDaysAgo(45),
    opponent_name: undefined,
    opponent_avatar: null,
    score_summary: null,
    partner_name: null,
  },
];

const MOCK_MATCHES: ProfileSummaryRecentMatch[] = RAW.map((m, i) => ({
  ...m,
  level_after: 3.41 + i * 0.01,
  source_ref_id: null,
  opponent_id: null,
}));

const FRAMES = [
  { label: "Mobile (375)", width: 375, height: 720 },
  { label: "Mobile L (414)", width: 414, height: 720 },
  { label: "Tablet (768)", width: 768, height: 720 },
  { label: "Desktop (1280)", width: 1280, height: 720 },
] as const;

const DevPreview = () => {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  // Bloqueado en producción
  if (import.meta.env.PROD) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-muted/30 p-4 md:p-8">
      <div className="mx-auto max-w-[1400px]">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold">Preview · Componentes</h1>
            <p className="text-sm text-muted-foreground">
              Vista responsive solo en desarrollo. Ruta bloqueada en producción.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={theme === "light" ? "default" : "outline"}
              onClick={() => setTheme("light")}
            >
              Light
            </Button>
            <Button
              size="sm"
              variant={theme === "dark" ? "default" : "outline"}
              onClick={() => setTheme("dark")}
            >
              Dark
            </Button>
          </div>
        </div>

        <Tabs defaultValue="recent-matches" className="w-full">
          <TabsList>
            <TabsTrigger value="recent-matches">Últimos partidos</TabsTrigger>
            <TabsTrigger value="profile-stats">Stats perfil (anillos)</TabsTrigger>
          </TabsList>

          <TabsContent value="recent-matches" className="mt-4">
            <div className="flex flex-wrap gap-6 overflow-x-auto pb-4">
              {FRAMES.map((frame) => (
                <div key={frame.label} className="shrink-0">
                  <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <span className="font-display font-semibold text-foreground">
                      {frame.label}
                    </span>
                    <span className="rounded bg-muted px-1.5 py-0.5 tabular-nums">
                      {frame.width}×{frame.height}
                    </span>
                  </div>
                  <div
                    className={cn(theme)}
                    style={{ width: frame.width, height: frame.height }}
                  >
                    <div className="flex h-full w-full flex-col overflow-y-auto rounded-2xl border border-border bg-background p-4 shadow-lg">
                      <h2 className="mb-3 font-display text-base font-bold">
                        Últimos partidos
                      </h2>
                      <RecentMatchesCarousel
                        matches={MOCK_MATCHES}
                        meName="Héctor Smith"
                        meAvatar={null}
                        meLevel={3.41}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="profile-stats" className="mt-4">
            <div className="flex flex-wrap gap-6 overflow-x-auto pb-4">
              {FRAMES.slice(0, 3).map((frame) => (
                <div key={frame.label} className="shrink-0">
                  <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <span className="font-display font-semibold text-foreground">
                      {frame.label}
                    </span>
                  </div>
                  <div
                    className={cn(theme)}
                    style={{ width: frame.width, height: frame.height }}
                  >
                    <div className="flex h-full w-full flex-col gap-3 overflow-y-auto rounded-2xl border border-border bg-background p-4 shadow-lg">
                      <h2 className="font-display text-base font-bold">Estadísticas</h2>
                      <div className="rounded-3xl border border-border bg-card p-4">
                        <div className="grid grid-cols-3 gap-2">
                          <div className="flex flex-col items-center gap-1.5 text-center">
                            <StatRing percent={72} centerLabel="72%" tone="success" />
                            <p className="text-[10px] font-semibold uppercase tracking-wide">Ganados</p>
                            <p className="text-[10px] text-muted-foreground">17V · 7D</p>
                          </div>
                          <div className="flex flex-col items-center gap-1.5 text-center">
                            <StatRing percent={80} centerLabel="24" tone="primary" />
                            <p className="text-[10px] font-semibold uppercase tracking-wide">Partidos</p>
                            <p className="text-[10px] text-muted-foreground">jugados</p>
                          </div>
                          <div className="flex flex-col items-center gap-1.5 text-center">
                            <Last10StreakRing
                              results={[true, true, false, true, true, false, true, false, true, true]}
                            />
                            <p className="text-[10px] font-semibold uppercase tracking-wide">Últimos 10</p>
                            <p className="text-[10px] text-muted-foreground">7V · 3D</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

// Pequeño helper local para evitar import extra
const cn = (...c: string[]) => c.filter(Boolean).join(" ");

export default DevPreview;
