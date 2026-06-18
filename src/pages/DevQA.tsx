/**
 * /dev/qa — Harness DEV-only para correr manualmente las Fases 1, 2, 4 y 5
 * del Protocolo QA Torneos. NO se monta en producción.
 */
import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useCelebrate } from '@/hooks/useCelebrate';
import {
  Confetti,
  RingAnimated,
  HapticButton,
  useCountUp,
  type HapticLevel,
} from '@/components/feedback';
import { celebrateMajorOnce, clearCelebrationFlags } from '@/lib/feedback/celebrateOnce';
import { StandingsHero } from '@/components/tournaments/standings/StandingsHero';
import { getRelegationZone } from '@/lib/tournament-utils';

export default function DevQA() {
  if (!import.meta.env.DEV) return <Navigate to="/" replace />;

  const celebrate = useCelebrate();
  const [pos, setPos] = useState(5);
  const [total, setTotal] = useState(12);
  const [demoCount, setDemoCount] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  const counted = useCountUp(demoCount, { duration: 900 });

  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const hapticLevels: HapticLevel[] = [
    'light',
    'medium',
    'heavy',
    'success',
    'warning',
    'error',
    'champ',
  ];

  return (
    <div className="min-h-screen bg-background px-4 py-6 lg:px-8">
      <div className="mx-auto max-w-3xl space-y-8">
        <header className="border-b border-border pb-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-muted-foreground">
            DEV · Protocolo QA Torneos
          </p>
          <h1 className="font-display text-3xl">Harness /dev/qa</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ejecuta manualmente Fases 1, 2, 4 y 5. Solo visible en DEV.
          </p>
        </header>

        {/* ============ A · Celebraciones ============ */}
        <Section title="A · Celebraciones (Fase 1)">
          <div className="flex flex-wrap gap-2">
            <Btn onClick={() => celebrate({ kind: 'minor', title: 'Punto ganado', subtitle: 'minor toast' })}>
              Minor
            </Btn>
            <Btn onClick={() => celebrate({ kind: 'major', title: 'Subiste a #3', subtitle: 'major overlay' })}>
              Major
            </Btn>
            <Btn
              onClick={() =>
                celebrate({
                  kind: 'epic',
                  title: '¡Campeón!',
                  subtitle: 'epic + confetti',
                  tournamentId: 'dev-qa-test',
                })
              }
            >
              Epic
            </Btn>
            <Btn
              onClick={() =>
                celebrateMajorOnce(celebrate, 'pos:dev:5:3', {
                  title: 'Major idempotente',
                  subtitle: 'solo 1 vez por sesión',
                })
              }
            >
              celebrateMajorOnce
            </Btn>
            <Btn
              variant="ghost"
              onClick={() => {
                clearCelebrationFlags();
                alert('Flags limpiados — vuelve a probar Epic / Once.');
              }}
            >
              clearCelebrationFlags()
            </Btn>
          </div>
          <p className="text-xs text-muted-foreground">
            <code>window.__celebrate</code> también disponible en consola.
          </p>
        </Section>

        {/* ============ B · Standings & zonas ============ */}
        <Section title="B · Standings & zonas (Fase 2)">
          <div className="flex flex-wrap gap-3 text-sm">
            <label className="flex items-center gap-2">
              Posición
              <input
                type="number"
                value={pos}
                onChange={(e) => setPos(Number(e.target.value))}
                className="w-20 rounded border bg-background px-2 py-1"
              />
            </label>
            <label className="flex items-center gap-2">
              Total
              <input
                type="number"
                value={total}
                onChange={(e) => setTotal(Number(e.target.value))}
                className="w-20 rounded border bg-background px-2 py-1"
              />
            </label>
            <span className="self-center text-xs text-muted-foreground">
              Zona actual: <strong>{getRelegationZone(pos, total)}</strong>
            </span>
          </div>
          <div className="-mx-[18px]">
            <StandingsHero
              position={pos}
              total={total}
              pj={8}
              pg={5}
              pp={3}
              points={42.5}
              delta={2}
              consecutiveWins={3}
              tailWinsNeeded={2}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Prueba: 1/12 (safe), 9/12 (warning ámbar), 11/12 (danger naranjo).
          </p>
        </Section>

        {/* ============ C · Reduced motion ============ */}
        <Section title="C · Reduced motion (Fase 4)">
          <p className="text-sm">
            Estado actual:{' '}
            <strong className={reducedMotion ? 'text-amber-600' : 'text-emerald-600'}>
              {reducedMotion ? 'REDUCED' : 'NORMAL'}
            </strong>{' '}
            — DevTools → Rendering → "Emulate CSS prefers-reduced-motion".
          </p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <DemoCard label="RingAnimated">
              <RingAnimated pct={72} size={80} stroke={8} />
            </DemoCard>
            <DemoCard label="useCountUp">
              <div className="font-display text-3xl">{counted}</div>
              <Btn variant="ghost" onClick={() => setDemoCount((c) => c + 100)}>
                +100
              </Btn>
            </DemoCard>
            <DemoCard label="Confetti">
              <div className="relative h-20 w-full">
                {showConfetti && <Confetti kind="major" duration={1800} />}
              </div>
              <Btn variant="ghost" onClick={() => { setShowConfetti(false); setTimeout(() => setShowConfetti(true), 50); }}>
                Lanzar
              </Btn>
            </DemoCard>
            <DemoCard label="Shimmer">
              <div className="shimmer-host h-16 w-full rounded bg-muted" />
            </DemoCard>
          </div>
        </Section>

        {/* ============ D · Háptica ============ */}
        <Section title="D · Háptica (Fase 5)">
          <p className="text-xs text-muted-foreground">
            En desktop = no-op silencioso. Probar en device físico iOS/Android.
          </p>
          <div className="flex flex-wrap gap-2">
            {hapticLevels.map((lvl) => (
              <HapticButton
                key={lvl}
                level={lvl}
                className="rounded-md border border-border bg-background px-3 py-2 text-sm hover:bg-muted"
              >
                {lvl}
              </HapticButton>
            ))}
          </div>
        </Section>

        {/* ============ E · Sanity ============ */}
        <Section title="E · Sanity Fase 0">
          <pre className="rounded bg-muted p-3 text-xs">bash scripts/qa-motion-haptic.sh</pre>
          <p className="text-xs text-muted-foreground">
            Verifica que la API de vibración esté centralizada, los keyframes en index.css y override reduced-motion.
          </p>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-lg border border-border bg-card p-4">
      <h2 className="font-display text-lg">{title}</h2>
      {children}
    </section>
  );
}

function Btn({
  children,
  onClick,
  variant = 'solid',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'solid' | 'ghost';
}) {
  const base = 'rounded-md px-3 py-2 text-sm transition-colors';
  const styles =
    variant === 'ghost'
      ? 'border border-border bg-background hover:bg-muted'
      : 'bg-primary text-primary-foreground hover:bg-primary/90';
  return (
    <button onClick={onClick} className={`${base} ${styles}`}>
      {children}
    </button>
  );
}

function DemoCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-md border border-border bg-background p-3">
      <span className="font-mono text-[9px] uppercase tracking-[0.32em] text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  );
}