// TODO: cablear fase 2
import type { PushCategory } from "@/lib/push-templates";

export type PushPreferences = Record<PushCategory, boolean>;

const DEFAULTS: PushPreferences = { juego: true, marketing: true, sistema: true };

export function useUserPushPreferences() {
  // TODO: cablear fase 2
  return {
    prefs: DEFAULTS,
    loading: false,
    update: async (_patch: Partial<PushPreferences>) => {},
  };
}
