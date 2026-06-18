// TODO: cablear fase 2
export interface AvailabilitySlot {
  id?: string;
  weekday: number;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
}

export const useUserAvailability = () => {
  // TODO: cablear fase 2
  return {
    slots: [] as AvailabilitySlot[],
    loading: false,
    refresh: async () => {},
    saveAll: async (_next: Omit<AvailabilitySlot, "id">[]) => {},
    hasAvailability: false,
  };
};
