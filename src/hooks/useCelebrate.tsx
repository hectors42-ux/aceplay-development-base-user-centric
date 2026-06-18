import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  CelebrationOverlay,
  type CelebrationProps,
} from '@/components/feedback/CelebrationOverlay';

type CelebrateFn = (props: Omit<CelebrationProps, 'onClose'>) => void;

const CelebrateCtx = createContext<CelebrateFn>(() => {});

export function CelebrateProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<CelebrationProps | null>(null);

  const celebrate = useCallback<CelebrateFn>((props) => {
    // PRD 1 · idempotencia EPIC — guard antes del mount (test QA 6.5.4).
    if (props.kind === 'epic' && props.tournamentId) {
      try {
        const flag = `celebrated:tournament:${props.tournamentId}:champion`;
        if (typeof localStorage !== 'undefined' && localStorage.getItem(flag)) {
          return;
        }
      } catch {
        /* noop */
      }
    }
    setActive({ ...props, onClose: () => setActive(null) });
  }, []);

  // DEV-only: expone window.__celebrate para los tests manuales del Protocolo QA
  // (Fase 1.1.x). En producción no se monta.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as { __celebrate?: CelebrateFn }).__celebrate = celebrate;
    return () => {
      delete (window as unknown as { __celebrate?: CelebrateFn }).__celebrate;
    };
  }, [celebrate]);

  return (
    <CelebrateCtx.Provider value={celebrate}>
      {children}
      {active && <CelebrationOverlay {...active} />}
    </CelebrateCtx.Provider>
  );
}

export function useCelebrate() {
  return useContext(CelebrateCtx);
}