import { useEffect, type ReactNode } from 'react';
import { X, Check, Trophy, ArrowRight, Share2, Zap, Coins } from 'lucide-react';
import { Confetti } from './Confetti';
import { useCountUp } from './useCountUp';
import { HapticButton } from './HapticButton';
import { haptic } from '@/lib/feedback/haptic';
import { cn } from '@/lib/utils';

export type CelebrationKind = 'minor' | 'major' | 'epic';

export interface CelebrationProps {
  kind: CelebrationKind;
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  /** Para `major`: anima desde `from` hasta `to` (posición/puntos). */
  delta?: [from: number, to: number];
  /** Pill secundario opcional para `minor` (ej. "+1 PG"). */
  pill?: string;
  /** Recompensas, mostradas en CAPAS SEPARADAS: XP (habilidad/volt) ≠ Fichas (premio/oro). */
  xp?: number;
  fichas?: number;
  /** Solo `minor`. Default 4000ms. */
  duration?: number;
  onClose?: () => void;
  /** Solo `epic`: setea flag `localStorage` para no repetir la coronación. */
  tournamentId?: string;
  /** Solo `epic`: si se provee, el CTA primario comparte el cuadro. */
  shareUrl?: string;
  /** Solo `epic`: podio renderizable. */
  podium?: {
    first: { name: string; avatarUrl?: string | null };
    second?: { name: string; avatarUrl?: string | null };
    third?: { name: string; avatarUrl?: string | null };
  };
}

export function CelebrationOverlay(props: CelebrationProps) {
  useEffect(() => {
    if (props.kind === 'minor') {
      haptic('success');
      return;
    }
    if (props.kind === 'major') {
      haptic('success');
      const t = setTimeout(() => haptic('medium'), 350);
      return () => clearTimeout(t);
    }
    if (props.kind === 'epic') {
      haptic('champ');
    }
  }, [props.kind]);

  if (props.kind === 'minor') return <MinorToast {...props} />;
  if (props.kind === 'major') return <MajorOverlay {...props} />;
  return <EpicCeremony {...props} />;
}

// Recompensas en CAPAS SEPARADAS — XP (habilidad, volt) y Fichas (premio, oro)
// nunca se mezclan: refuerza el firewall visual (XP no compra Fichas ni viceversa).
function RewardRow({ xp, fichas, className }: { xp?: number; fichas?: number; className?: string }) {
  if (xp == null && fichas == null) return null;
  return (
    <div className={cn('flex flex-wrap items-center justify-center gap-2', className)}>
      {xp != null && (
        <span className="inline-flex items-center gap-1 rounded-full bg-skill/20 px-2.5 py-1 text-xs font-bold text-skill">
          <Zap className="h-3.5 w-3.5" /> +{xp} XP
        </span>
      )}
      {fichas != null && (
        <span className="inline-flex items-center gap-1 rounded-full bg-fichas/20 px-2.5 py-1 text-xs font-bold text-fichas">
          <Coins className="h-3.5 w-3.5" /> +{fichas} Fichas
        </span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MINOR — toast bottom, no bloquea taps
// ─────────────────────────────────────────────────────────────
function MinorToast({ title, subtitle, pill, xp, fichas, duration = 4000, onClose }: CelebrationProps) {
  useEffect(() => {
    const t = setTimeout(() => onClose?.(), duration);
    return () => clearTimeout(t);
  }, [duration, onClose]);

  return (
    <div
      style={{ position: 'fixed', bottom: 28, left: 18, right: 18, zIndex: 50, pointerEvents: 'none' }}
      role="status"
      aria-live="polite"
    >
      <div
        className="rise-in mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-border bg-card/95 p-3 shadow-2xl backdrop-blur"
        style={{ pointerEvents: 'auto' }}
      >
        <div
          className="pop-in glow flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-white"
          style={{ background: 'var(--gradient-clay)' }}
        >
          <Check className="h-7 w-7" strokeWidth={3} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-base font-semibold leading-tight">{title}</p>
          {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {pill && (
          <span className="shrink-0 rounded-full bg-primary/15 px-2.5 py-1 text-[11px] font-semibold text-primary">
            {pill}
          </span>
        )}
        <RewardRow xp={xp} fichas={fichas} className="shrink-0" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MAJOR — overlay full-screen con delta animado
// ─────────────────────────────────────────────────────────────
function MajorOverlay({ title, subtitle, badge, delta, xp, fichas, onClose }: CelebrationProps) {
  const target = delta ? delta[1] : 0;
  const start = delta ? delta[0] : 0;
  const animated = useCountUp(target, { start, duration: 1100 });

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden px-6"
      style={{ background: 'var(--gradient-clay-deep)' }}
      role="dialog"
      aria-modal="true"
    >
      <Confetti kind="major" />
      <Sparkles count={10} />

      <HapticButton
        level="light"
        onClick={onClose}
        className="absolute right-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/20"
        aria-label="Cerrar"
      >
        <X className="h-5 w-5" />
      </HapticButton>

      <p
        className="z-10 mb-3 text-[11px] font-semibold uppercase text-white/70"
        style={{ fontFamily: "'DM Mono', monospace", letterSpacing: '0.32em' }}
      >
        Logro desbloqueado
      </p>

      <div
        className="pop-in z-10 mb-5 flex h-[150px] w-[150px] items-center justify-center rounded-full text-white shadow-2xl"
        style={{ background: 'var(--gradient-clay)' }}
      >
        {delta ? (
          <span
            className="count-pop font-display font-semibold leading-none"
            style={{ fontSize: 72 }}
          >
            {animated}
          </span>
        ) : (
          badge ?? <Trophy className="h-16 w-16" />
        )}
      </div>

      <h2
        className="z-10 text-center font-display font-semibold leading-tight text-white"
        style={{ fontSize: 38 }}
      >
        {title}
      </h2>

      {delta && (
        <div className="z-10 mt-4 flex items-center gap-3 rounded-full bg-white/10 px-5 py-2 text-white backdrop-blur">
          <span className="text-base font-medium line-through opacity-60">#{delta[0]}</span>
          <ArrowRight className="h-4 w-4 opacity-80" />
          <span className="font-display font-semibold leading-none" style={{ fontSize: 44 }}>
            #{delta[1]}
          </span>
        </div>
      )}

      {subtitle && (
        <p className="z-10 mt-4 max-w-sm text-center text-white/75" style={{ fontSize: 13.5 }}>
          {subtitle}
        </p>
      )}

      {/* XP y Fichas en capas separadas — nunca se mezclan (firewall visual). */}
      <RewardRow xp={xp} fichas={fichas} className="z-10 mt-5" />

      <HapticButton
        level="medium"
        onClick={onClose}
        className="z-10 mt-8 flex items-center gap-2 rounded-full bg-white px-6 py-3 font-semibold text-ink shadow-lg transition hover:scale-[1.02]"
      >
        Continuar
        <ArrowRight className="h-4 w-4" />
      </HapticButton>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// EPIC — ceremonia con podio
// ─────────────────────────────────────────────────────────────
function EpicCeremony({
  title,
  subtitle,
  badge,
  podium,
  tournamentId,
  shareUrl,
  onClose,
}: CelebrationProps) {
  const handleClose = () => {
    if (tournamentId) {
      try {
        localStorage.setItem(`celebrated:tournament:${tournamentId}:champion`, '1');
      } catch {
        /* storage bloqueado, no es bloqueante */
      }
    }
    onClose?.();
  };

  const handleShare = async () => {
    if (!shareUrl) return handleClose();
    try {
      if (navigator.share) {
        await navigator.share({ title, url: shareUrl });
      } else {
        await navigator.clipboard.writeText(shareUrl);
      }
    } catch {
      /* usuario canceló o navegador no soporta */
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center overflow-y-auto px-6 py-10"
      style={{
        background:
          'linear-gradient(170deg, hsl(var(--ink)) 0%, hsl(var(--primary-deep)) 65%, hsl(var(--primary)) 130%)',
      }}
      role="dialog"
      aria-modal="true"
    >
      <Confetti kind="epic" />
      <Sparkles count={22} />

      <HapticButton
        level="light"
        onClick={handleClose}
        className="absolute right-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/20"
        aria-label="Cerrar"
      >
        <X className="h-5 w-5" />
      </HapticButton>

      <div
        className="pop-in trophy-bob z-10 mt-6 flex h-[156px] w-[156px] items-center justify-center rounded-full text-white shadow-2xl"
        style={{ background: 'var(--gradient-clay)' }}
      >
        {badge ?? <Trophy style={{ width: 74, height: 74 }} />}
      </div>

      <h1
        className="z-10 mt-6 text-center font-display font-semibold leading-tight text-white"
        style={{ fontSize: 46 }}
      >
        ¡<em className="not-italic" style={{ fontStyle: 'italic', color: 'hsl(var(--gold))' }}>Campeón</em>!
      </h1>

      {podium?.first?.name && (
        <p
          className="z-10 mt-1 font-display text-white"
          style={{ fontSize: 22 }}
        >
          {podium.first.name}
        </p>
      )}

      {subtitle && (
        <p className="z-10 mt-1 text-[12px] text-white/65">{subtitle}</p>
      )}

      {podium && (
        <div
          className="stagger z-10 mt-8 w-full max-w-sm items-end"
          style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1fr', gap: 8, alignItems: 'end' }}
        >
          <PodiumStep
            place={2}
            name={podium.second?.name ?? '—'}
            height={92}
            bg="linear-gradient(180deg, hsl(220 8% 70%), hsl(220 8% 48%))"
          />
          <PodiumStep
            place={1}
            name={podium.first.name}
            height={132}
            bg="var(--gradient-clay)"
            champion
          />
          <PodiumStep
            place={3}
            name={podium.third?.name ?? '—'}
            height={70}
            bg="linear-gradient(180deg, hsl(30 50% 55%), hsl(20 60% 38%))"
          />
        </div>
      )}

      <div className="z-10 mt-8 w-full max-w-sm rounded-2xl border border-white/15 bg-white/8 p-4 text-white backdrop-blur">
        <p
          className="mb-1 text-[10px] uppercase opacity-70"
          style={{ fontFamily: "'DM Mono', monospace", letterSpacing: '0.32em' }}
        >
          Resumen del torneo
        </p>
        <p className="text-sm opacity-90">
          Felicidades — tu coronación quedó registrada en el historial del club.
        </p>
      </div>

      <div className="z-10 mt-6 flex w-full max-w-sm flex-col gap-2">
        <HapticButton
          level="medium"
          onClick={handleShare}
          className="flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 font-semibold text-ink shadow-lg transition hover:scale-[1.02]"
        >
          <Share2 className="h-4 w-4" />
          Compartir el cuadro final
        </HapticButton>
        <div className="grid grid-cols-2 gap-2">
          <HapticButton
            level="light"
            onClick={handleClose}
            className="rounded-full border border-white/30 bg-transparent px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
          >
            Ver bracket
          </HapticButton>
          <HapticButton
            level="light"
            onClick={handleClose}
            className="rounded-full border border-white/30 bg-transparent px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
          >
            Estadísticas
          </HapticButton>
        </div>
      </div>
    </div>
  );
}

function PodiumStep({
  place,
  name,
  height,
  bg,
  champion,
}: {
  place: 1 | 2 | 3;
  name: string;
  height: number;
  bg: string;
  champion?: boolean;
}) {
  return (
    <div className="flex flex-col items-center">
      <p className="mb-2 max-w-full truncate text-center text-[11px] font-medium text-white/90">
        {name}
      </p>
      <div
        className="flex w-full items-start justify-center rounded-t-xl pt-2 text-white shadow-inner"
        style={{ height, background: bg }}
      >
        <span
          className="font-display font-semibold leading-none"
          style={{ fontSize: champion ? 32 : 22 }}
        >
          {place}
        </span>
      </div>
    </div>
  );
}

function Sparkles({ count }: { count: number }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0">
      {Array.from({ length: count }).map((_, i) => {
        const top = Math.round((i * 53) % 95);
        const left = Math.round((i * 37) % 95);
        const size = 4 + (i % 5) * 2;
        return (
          <span
            key={i}
            className="float absolute rounded-full"
            style={{
              top: `${top}%`,
              left: `${left}%`,
              width: size,
              height: size,
              background: 'hsl(var(--gold) / 0.55)',
              boxShadow: '0 0 12px hsl(var(--gold) / 0.7)',
              animationDelay: `${(i % 7) * 0.15}s`,
            }}
          />
        );
      })}
    </div>
  );
}