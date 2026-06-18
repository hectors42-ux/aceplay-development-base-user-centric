// TODO: cablear fase 2
export interface SlotOption {
  startsAt: Date;
  endsAt: Date;
  courtId: string;
  courtName: string;
  durationMin: number;
}

interface Params {
  coachId: string | null | undefined;
  duration: number;
  days?: number;
  externalOnly?: boolean;
  enabled?: boolean;
  sport?: "tenis" | "padel";
}

export const useCoachSlots = (_p: Params) => {
  // TODO: cablear fase 2
  return { slots: [] as SlotOption[], isLoading: false, courts: [] as any[] };
};
