import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Home, Compass, Swords, LayoutGrid, User } from "lucide-react";
import {
  LayerHud, ArenaHero, Steps, LeagueChip, StreakChip, XPMeter,
  CoinPill, TierGem, TIER_ORDER, LiveBadge, SponsorLockup, MatchScore,
  ArenaBottomNav, type NavItemSpec,
} from "@/components/arena";
import { CelebrationOverlay } from "@/components/feedback";
import { ROLE_PALETTE } from "@/lib/themes";

const NAV: NavItemSpec[] = [
  { id: "home", label: "Inicio", icon: Home },
  { id: "descubrir", label: "Descubrir", icon: Compass },
  { id: "desafio", label: "Desafío", icon: Swords, fab: true },
  { id: "espacios", label: "Espacios", icon: LayoutGrid },
  { id: "perfil", label: "Perfil", icon: User },
];

const Section = ({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) => (
  <section className="space-y-3">
    <div>
      <h2 className="font-display text-lg font-semibold text-foreground">{title}</h2>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
    <div className="rounded-2xl border border-border bg-card/50 p-4">{children}</div>
  </section>
);

const Showcase = () => {
  const [activeNav, setActiveNav] = useState("desafio");
  const [celebrate, setCelebrate] = useState(false);
  return (
    <div className="min-h-screen bg-background pb-16">
      <header className="safe-top sticky top-0 z-30 border-b border-border bg-background/85 px-5 py-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <Link to="/" className="flex h-9 w-9 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground hover:text-foreground" aria-label="Volver">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="font-display text-xl font-semibold">Showcase · Primitivas Arena</h1>
            <p className="text-[11px] text-muted-foreground">Épica H · tema Arena · respeta reduce-motion</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-8 px-5 py-6">
        {/* roles homologados */}
        <Section title="Roles homologados (G)" hint="Un hue por rol. Las primitivas solo usan estos tokens.">
          <div className="flex flex-wrap gap-3">
            {Object.entries(ROLE_PALETTE).map(([key, t]) => (
              <div key={key} className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5">
                <span className="h-4 w-4 rounded-full" style={{ background: `hsl(var(--${key}))` }} aria-hidden />
                <span className="text-xs font-semibold capitalize">{key}</span>
                <span className="text-[10px] text-muted-foreground">{t.hex}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* HUD de capas */}
        <Section title="HUD de capas" hint="Habilidad (Nivel) · Enganche (Liga+XP+Racha) · Premio (Fichas) — visualmente separadas.">
          <LayerHud
            nivel={5} categoria="Cuarta" sport="Pádel"
            tier="plata" division="Plata II" rank={3}
            xpWeek={118} xpMax={300} streakWeeks={6}
            fichas={130} onFichas={() => {}}
          />
        </Section>

        {/* habilidad */}
        <Section title="Capa habilidad" hint="ArenaHero (trofeo) + Steps (camino de ascenso 7 pasos). Color skill/volt.">
          <ArenaHero nivel={5} categoria="Cuarta" sport="Tenis" />
          <div className="mt-4">
            <Steps current={5} />
          </div>
        </Section>

        {/* enganche */}
        <Section title="Capa enganche" hint="Liga = constancia (nunca habilidad). LeagueChip + StreakChip + XPMeter + TierGem.">
          <div className="flex flex-wrap items-center gap-3">
            <LeagueChip tier="oro" division="Oro I" rank={1} />
            <StreakChip weeks={6} />
            <LiveBadge />
          </div>
          <XPMeter value={210} max={300} className="mt-4" />
          <div className="mt-4 flex items-end gap-4">
            {TIER_ORDER.map((t) => (
              <div key={t} className="flex flex-col items-center gap-1">
                <TierGem tier={t} size="lg" />
                <span className="text-[10px] capitalize text-muted-foreground">{t}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* premio */}
        <Section title="Capa premio + rating" hint="CoinPill: fichas (oro) vs rating (skill) — dos roles, nunca se mezclan.">
          <div className="flex flex-wrap items-center gap-3">
            <CoinPill kind="fichas" value={130} onClick={() => {}} />
            <CoinPill kind="rating" value={2088} delta={12} />
            <CoinPill kind="rating" value={1259} delta={-7} />
          </div>
        </Section>

        {/* marcador + sponsor */}
        <Section title="Marcador + sponsor" hint="MatchScore (ganador en verde) · SponsorLockup (neutro).">
          <MatchScore sets={[{ a: 6, b: 4 }, { a: 6, b: 3 }]} winner="a" labels={{ a: "Tú", b: "Rival" }} />
          <div className="mt-4">
            <SponsorLockup sponsor="Wilson" />
          </div>
        </Section>

        {/* nav */}
        <Section title="Bottom-nav + FAB" hint="Primitiva presentacional. FAB Desafío y tab activo en naranja de acción.">
          <ArenaBottomNav items={NAV} activeId={activeNav} onSelect={setActiveNav} />
        </Section>

        {/* ceremonia */}
        <Section title="Ceremonia" hint="Ascenso con XP (volt) y Fichas (oro) en capas SEPARADAS — nunca se mezclan.">
          <button
            type="button"
            onClick={() => setCelebrate(true)}
            className="rounded-full bg-action px-4 py-2 text-sm font-semibold text-action-foreground transition-transform hover:scale-105"
          >
            Ver ceremonia de ascenso
          </button>
        </Section>
      </main>

      {celebrate && (
        <CelebrationOverlay
          kind="major"
          title="¡Subiste de Liga!"
          subtitle="Tu constancia te llevó a Plata. Tu nivel (habilidad) no cambia."
          delta={[2, 1]}
          xp={40}
          fichas={25}
          onClose={() => setCelebrate(false)}
        />
      )}
    </div>
  );
};

export default Showcase;
